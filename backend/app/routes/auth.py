from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hashlib
import secrets
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from app.database import get_db, Usuario
from app.services.auth_service import auth_service
from app.services.email_service import email_service
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Armazenamento temporário de tokens de recuperação (em produção, usar Redis ou banco)
password_reset_tokens = {}


# =====================
# Debug endpoint
# =====================
@router.options("/register")
async def register_options():
    """Handle CORS preflight for register."""
    return {"message": "OK"}


def hash_password(password: str) -> str:
    """Hash password using SHA256."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash."""
    return hash_password(password) == hashed


# =====================
# Schemas
# =====================
class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# =====================
# Dependency para obter usuário atual
# =====================
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    """Obter usuário atual."""
    usuario = await auth_service.get_current_user(token, db)
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )
    
    return usuario


# =====================
# Endpoints
# =====================
@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """Registrar novo usuário."""
    try:
        # Verificar se email já existe
        result = await db.execute(
            select(Usuario).where(Usuario.email == user_data.email)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email já cadastrado"
            )
        
        # Criar hash da senha
        senha_hash = hash_password(user_data.password)
        
        # Criar usuário
        novo_usuario = Usuario(
            email=user_data.email,
            nome=user_data.name,
            senha_hash=senha_hash
        )
        
        db.add(novo_usuario)
        await db.commit()
        await db.refresh(novo_usuario)
        
        # Gerar token
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
        raise
    except Exception as e:
        print(f"❌ Erro ao registrar: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar conta: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Login do usuário."""
    # Buscar usuário
    result = await db.execute(
        select(Usuario).where(Usuario.email == login_data.email)
    )
    usuario = result.scalar_one_or_none()
    
    if not usuario or not verify_password(login_data.password, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    
    # Gerar token
    token = auth_service.create_jwt_token(usuario)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=usuario.id,
            email=usuario.email,
            name=usuario.nome
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Usuario = Depends(get_current_user)
):
    """Obter usuário atual."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.nome
    )


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Solicitar recuperação de senha."""
    # Buscar usuário
    result = await db.execute(
        select(Usuario).where(Usuario.email == request.email)
    )
    usuario = result.scalar_one_or_none()
    
    # Sempre retorna sucesso para não revelar se o email existe
    if usuario:
        # Gerar token único
        token = secrets.token_urlsafe(32)
        
        # Armazenar token com expiração de 1 hora
        password_reset_tokens[token] = {
            "user_id": usuario.id,
            "email": usuario.email,
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        }
        
        # URL de reset
        reset_url = f"{settings.frontend_url}/reset-password?token={token}"
        
        # Enviar e-mail em background
        background_tasks.add_task(
            send_password_reset_email,
            to_email=usuario.email,
            user_name=usuario.nome,
            reset_url=reset_url
        )
    
    return {"message": "Se o e-mail estiver cadastrado, você receberá um link de recuperação."}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """Redefinir senha."""
    # Verificar token
    token_data = password_reset_tokens.get(request.token)
    
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido ou expirado"
        )
    
    # Verificar expiração
    if datetime.utcnow() > token_data["expires_at"]:
        del password_reset_tokens[request.token]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido ou expirado"
        )
    
    # Buscar usuário
    result = await db.execute(
        select(Usuario).where(Usuario.id == token_data["user_id"])
    )
    usuario = result.scalar_one_or_none()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    # Atualizar senha
    usuario.senha_hash = hash_password(request.new_password)
    await db.commit()
    
    # Remover token usado
    del password_reset_tokens[request.token]
    
    return {"message": "Senha redefinida com sucesso!"}


async def send_password_reset_email(to_email: str, user_name: str, reset_url: str):
    """Enviar e-mail de recuperação de senha."""
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
