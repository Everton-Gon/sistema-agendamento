"""
=============================================================
  auth.py — Rotas de autenticação
=============================================================
  Endpoints:
  - POST /api/auth/register    → Registrar novo usuário
  - POST /api/auth/login       → Login (retorna JWT)
  - POST /api/auth/microsoft   → Login com conta Microsoft (SSO)
  - GET  /api/auth/me          → Dados do usuário logado
  - POST /api/auth/forgot-password → Solicitar reset de senha
  - POST /api/auth/reset-password  → Redefinir senha com token
  
  Autenticação via JWT (JSON Web Token) com SHA-256 para hash de senhas.
=============================================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hashlib
import secrets
import httpx
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from app.database import get_db, Usuario
from app.services.auth_service import auth_service
from app.services.email_service import email_service
from app.config import get_settings

settings = get_settings()

# Router com prefixo /api/auth — todos os endpoints herdam esse caminho
router = APIRouter(prefix="/api/auth", tags=["auth"])

# Esquema OAuth2 — extrai o token JWT do header "Authorization: Bearer <token>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# Armazenamento temporário de tokens de recuperação de senha
# NOTA: Em produção, usar Redis ou banco de dados para persistência
password_reset_tokens = {}


# =============================================
# Endpoint de debug para CORS
# =============================================
@router.options("/register")
async def register_options():
    """
    Responde a requisições CORS preflight (OPTIONS) para /register.
    Necessário quando o frontend faz POST de outra origem.
    """
    return {"message": "OK"}


# =============================================
# Funções utilitárias de senha
# =============================================
def hash_password(password: str) -> str:
    """
    Cria hash SHA-256 da senha.
    Converte a senha em texto para um hash irreversível de 64 caracteres.
    
    Exemplo: "minhasenha" → "5e884898da28047151d0e56f8dc..."
    """
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """
    Verifica se a senha informada corresponde ao hash armazenado.
    Compara o hash da senha digitada com o hash salvo no banco.
    
    Returns:
        True se a senha está correta, False caso contrário
    """
    return hash_password(password) == hashed


# =============================================
# Schemas Pydantic (validação de entrada/saída)
# =============================================
class UserRegister(BaseModel):
    """Dados necessários para registrar um novo usuário."""
    email: EmailStr       # E-mail válido (verificado pelo Pydantic)
    name: str             # Nome completo
    password: str         # Senha em texto (será convertida em hash)


class UserLogin(BaseModel):
    """Dados necessários para fazer login."""
    email: EmailStr       # E-mail cadastrado
    password: str         # Senha em texto


class UserResponse(BaseModel):
    """Dados do usuário retornados nas respostas da API."""
    id: int               # ID no banco
    email: str            # E-mail
    name: str             # Nome completo
    
    class Config:
        from_attributes = True    # Permite converter de modelo SQLAlchemy


class TokenResponse(BaseModel):
    """Resposta de login/registro — contém o JWT e dados do usuário."""
    access_token: str             # Token JWT para autenticação
    token_type: str = "bearer"    # Tipo do token (padrão OAuth2)
    user: UserResponse            # Dados do usuário logado


class ForgotPasswordRequest(BaseModel):
    """Dados para solicitar recuperação de senha."""
    email: EmailStr               # E-mail da conta a recuperar


class ResetPasswordRequest(BaseModel):
    """Dados para redefinir a senha."""
    token: str                    # Token recebido por e-mail
    new_password: str             # Nova senha escolhida


class MicrosoftLoginRequest(BaseModel):
    """Token de acesso recebido do Microsoft Entra ID (via MSAL no frontend)."""
    access_token: str             # access_token da Microsoft para chamar o Graph API


# =============================================
# Dependency: Obter usuário autenticado
# =============================================
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    """
    Dependency do FastAPI que extrai e valida o usuário do token JWT.
    
    Usado em rotas que exigem autenticação:
        async def minha_rota(current_user: Usuario = Depends(get_current_user)):
    
    Fluxo:
    1. FastAPI extrai o token do header "Authorization: Bearer <token>"
    2. O auth_service decodifica o JWT e busca o usuário no banco
    3. Se válido, retorna o objeto Usuario; se não, retorna 401
    """
    usuario = await auth_service.get_current_user(token, db)
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )
    
    return usuario


# =============================================
# POST /api/auth/register — Registrar novo usuário
# =============================================
@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """
    Registra um novo usuário no sistema.
    
    Fluxo:
    1. Verifica se o e-mail já está cadastrado
    2. Cria hash SHA-256 da senha
    3. Salva o usuário no MySQL
    4. Gera token JWT
    5. Retorna o token + dados do usuário (login automático)
    """
    try:
        # Verifica se e-mail já está em uso
        result = await db.execute(
            select(Usuario).where(Usuario.email == user_data.email)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email já cadastrado"
            )
        
        # Cria hash irreversível da senha
        senha_hash = hash_password(user_data.password)
        
        # Cria o registro no banco
        novo_usuario = Usuario(
            email=user_data.email,
            nome=user_data.name,
            senha_hash=senha_hash
        )
        
        db.add(novo_usuario)
        await db.commit()
        await db.refresh(novo_usuario)   # Atualiza o objeto com o ID gerado
        
        # Gera token JWT (usuário já fica logado após registro)
        token = auth_service.create_jwt_token(novo_usuario)
        
        return TokenResponse(
            access_token=token,
            user=UserResponse(
                id=novo_usuario.id,
                email=novo_usuario.email,
                name=novo_usuario.nome
            )
        )
    except HTTPException:
        raise                            # Re-lança erros HTTP conhecidos
    except Exception as e:
        print(f"[ERROR] Erro ao registrar: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar conta: {str(e)}"
        )


# =============================================
# POST /api/auth/microsoft — Login com Microsoft (SSO)
# =============================================
@router.post("/microsoft", response_model=TokenResponse)
async def login_microsoft(
    data: MicrosoftLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Autentica o usuário via conta Microsoft corporativa (SSO).
    
    Fluxo:
    1. Recebe o access_token emitido pela Microsoft (via MSAL no frontend)
    2. Chama a API do Microsoft Graph para obter nome e e-mail do usuário
    3. Busca o usuário no banco pelo e-mail recebido
    4. Se não existir, cria automaticamente (sem senha, pois usa SSO)
    5. Gera e retorna o JWT próprio do sistema
    """
    # Passo 1: Buscar perfil do usuário no Microsoft Graph
    async with httpx.AsyncClient() as client:
        try:
            graph_response = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {data.access_token}"},
                timeout=10.0
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Não foi possível conectar ao Microsoft Graph"
            )

    # Valida resposta do Graph API
    if graph_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Microsoft inválido ou expirado"
        )

    graph_data = graph_response.json()

    # Extrai dados do perfil da Microsoft
    ms_email = graph_data.get("mail") or graph_data.get("userPrincipalName", "")
    ms_name = graph_data.get("displayName", ms_email.split("@")[0])

    if not ms_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível obter o e-mail da conta Microsoft"
        )

    # Passo 2: Busca usuário no banco pelo e-mail da Microsoft
    result = await db.execute(
        select(Usuario).where(Usuario.email == ms_email)
    )
    usuario = result.scalar_one_or_none()

    # Passo 3: Se não existir, cria automaticamente
    if not usuario:
        usuario = Usuario(
            email=ms_email,
            nome=ms_name,
            senha_hash=""         # SSO users não têm senha local
        )
        db.add(usuario)
        await db.commit()
        await db.refresh(usuario)
        print(f"[SSO] Novo usuário criado via Microsoft: {ms_email}")
    else:
        # Atualiza nome caso tenha mudado no Active Directory
        if usuario.nome != ms_name:
            usuario.nome = ms_name
            await db.commit()
        print(f"[SSO] Login Microsoft: {ms_email}")

    # Verifica se conta está ativa
    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Entre em contato com o administrador."
        )

    # Passo 4: Gera JWT próprio do sistema
    token = auth_service.create_jwt_token(usuario)

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=usuario.id,
            email=usuario.email,
            name=usuario.nome
        )
    )


# =============================================
# POST /api/auth/login — Login do usuário
# =============================================
@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Autentica o usuário e retorna um token JWT.
    
    Fluxo:
    1. Busca o usuário pelo e-mail no banco
    2. Verifica se a senha está correta (compara hashes)
    3. Verifica se o usuário está ativo
    4. Gera e retorna o token JWT
    """
    # Busca usuário pelo e-mail
    result = await db.execute(
        select(Usuario).where(Usuario.email == login_data.email)
    )
    usuario = result.scalar_one_or_none()
    
    # Verifica credenciais (mensagem genérica por segurança)
    if not usuario or not verify_password(login_data.password, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    # Verifica se a conta está ativa
    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    
    # Gera token JWT válido por 60 minutos
    token = auth_service.create_jwt_token(usuario)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=usuario.id,
            email=usuario.email,
            name=usuario.nome
        )
    )


# =============================================
# GET /api/auth/me — Dados do usuário logado
# =============================================
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna os dados do usuário autenticado.
    Usado pelo frontend para verificar se o token ainda é válido.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.nome
    )


# =============================================
# POST /api/auth/forgot-password — Solicitar recuperação
# =============================================
@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Solicita recuperação de senha por e-mail.
    
    Fluxo:
    1. Busca o usuário pelo e-mail
    2. Gera um token aleatório de 32 bytes
    3. Armazena o token com expiração de 1 hora
    4. Envia e-mail com link de reset em background
    
    NOTA: Sempre retorna sucesso, mesmo se o e-mail não existir,
    para não revelar quais e-mails estão cadastrados (segurança).
    """
    result = await db.execute(
        select(Usuario).where(Usuario.email == request.email)
    )
    usuario = result.scalar_one_or_none()
    
    if usuario:
        # Gera token criptograficamente seguro
        token = secrets.token_urlsafe(32)
        
        # Armazena com expiração de 1 hora
        password_reset_tokens[token] = {
            "user_id": usuario.id,
            "email": usuario.email,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        }
        
        # Monta URL de reset que aponta para o frontend
        reset_url = f"{settings.frontend_url}/reset-password?token={token}"
        
        # Envia e-mail em background (não bloqueia a resposta da API)
        background_tasks.add_task(
            send_password_reset_email,
            to_email=usuario.email,
            user_name=usuario.nome,
            reset_url=reset_url
        )
    
    return {"message": "Se o e-mail estiver cadastrado, você receberá um link de recuperação."}


# =============================================
# POST /api/auth/reset-password — Redefinir senha
# =============================================
@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Redefine a senha do usuário usando o token recebido por e-mail.
    
    Fluxo:
    1. Busca o token no armazenamento temporário
    2. Verifica se não expirou (válido por 1 hora)
    3. Busca o usuário pelo ID armazenado no token
    4. Atualiza o hash da senha no banco
    5. Remove o token usado (uso único)
    """
    # Verifica se o token existe
    token_data = password_reset_tokens.get(request.token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido ou expirado"
        )
    
    # Verifica se não expirou
    if datetime.utcnow() > token_data["expires_at"]:
        del password_reset_tokens[request.token]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido ou expirado"
        )
    
    # Busca o usuário no banco
    result = await db.execute(
        select(Usuario).where(Usuario.id == token_data["user_id"])
    )
    usuario = result.scalar_one_or_none()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    # Atualiza a senha com novo hash
    usuario.senha_hash = hash_password(request.new_password)
    await db.commit()
    
    # Remove token usado (cada token funciona uma vez só)
    del password_reset_tokens[request.token]
    
    return {"message": "Senha redefinida com sucesso!"}


# =============================================
# Função auxiliar: E-mail de recuperação de senha
# =============================================
async def send_password_reset_email(to_email: str, user_name: str, reset_url: str):
    """
    Envia e-mail de recuperação de senha com template HTML.
    
    Executada em background (não bloqueia a resposta da API).
    O e-mail contém um botão que direciona para a página de reset no frontend.
    
    Args:
        to_email: E-mail do usuário
        user_name: Nome do usuário (para personalizar)
        reset_url: URL completa do frontend com o token
    """
    subject = "🔐 Recuperação de Senha - Sistema de Agendamento"
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">🔐 Recuperação de Senha</h1>
            </div>
            <div style="padding: 30px;">
                <p>Olá <strong>{user_name}</strong>,</p>
                <p>Você solicitou a recuperação de senha do Sistema de Agendamento.</p>
                <p>Clique no botão abaixo para criar uma nova senha:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Redefinir Minha Senha
                    </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">Este link expira em <strong>1 hora</strong>.</p>
                <p style="color: #666; font-size: 14px;">Se você não solicitou a recuperação de senha, ignore este e-mail.</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                
                <p style="color: #999; font-size: 12px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
                <p style="color: #999; font-size: 12px; word-break: break-all;">{reset_url}</p>
            </div>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                <p>Sistema de Agendamento de Reuniões</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    await email_service.send_email(to_email, subject, html_body)


# =============================================
# GET /api/auth/users/search — People Picker (Busca Híbrida)
# =============================================
@router.get("/users/search")
async def search_users(
    q: str,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Busca usuários pelo nome ou e-mail para o campo de participantes.
    Ativado quando o usuário digita '@' ou texto na tela de Nova Reunião.

    Busca HÍBRIDA:
    1. Banco de dados local (MySQL) — usuários cadastrados no sistema
    2. Diretório do Microsoft 365 (Azure AD) — todos da organização

    - Resultados são unificados e deduplicados por e-mail
    - O próprio usuário logado é excluído dos resultados
    - Retorna até 10 resultados no total
    - Exige autenticação (token JWT)
    """
    from app.services.graph_service import graph_service

    if not q or len(q) < 2:
        return []

    # ── 1. Busca no banco local ──────────────────────────────────────────
    result = await db.execute(
        select(Usuario)
        .where(
            (Usuario.nome.ilike(f"%{q}%") | Usuario.email.ilike(f"%{q}%")),
            Usuario.id != current_user.id,
            Usuario.ativo == True
        )
        .limit(10)
    )
    local_users = result.scalars().all()
    local_list = [{"name": u.nome, "email": u.email} for u in local_users]

    # ── 2. Busca no Diretório da Microsoft 365 (Azure AD) ───────────────
    azure_list = await graph_service.search_users_in_directory(q)

    # ── 3. Mescla e remove duplicatas (e-mail do usuário atual também) ───
    seen_emails = {current_user.email.lower()}  # Exclui o próprio usuário

    merged = []
    for user in local_list + azure_list:
        email_lower = user["email"].lower()
        if email_lower not in seen_emails:
            seen_emails.add(email_lower)
            merged.append(user)
        if len(merged) >= 10:  # Limita a 10 resultados
            break

    return merged
