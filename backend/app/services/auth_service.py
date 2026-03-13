"""
=============================================================
  auth_service.py — Serviço de autenticação JWT
=============================================================
  Responsável por:
  - Criar tokens JWT para usuários autenticados
  - Verificar e decodificar tokens JWT recebidos
  - Buscar o usuário atual a partir de um token
  
  Usa o algoritmo HS256 com chave secreta configurável via .env
=============================================================
"""

from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import Usuario

settings = get_settings()


class AuthService:
    """Serviço singleton para operações de autenticação JWT."""
    
    def create_jwt_token(self, usuario: Usuario) -> str:
        """
        Cria um token JWT para o usuário.
        
        O token contém:
        - sub: ID do usuário (identificador único)
        - email: e-mail do usuário
        - nome: nome completo
        - exp: data/hora de expiração (padrão: 60 minutos)
        
        Args:
            usuario: Objeto Usuario do banco de dados
            
        Returns:
            String do token JWT codificado
        """
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        
        to_encode = {
            "sub": str(usuario.id),      # Subject (ID do usuário)
            "email": usuario.email,       # Para exibição rápida no frontend
            "nome": usuario.nome,         # Para exibição rápida no frontend
            "exp": expire                 # Timestamp de expiração
        }
        
        # Codifica o payload com a chave secreta
        encoded_jwt = jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )
        
        return encoded_jwt
    
    async def verify_jwt_token(self, token: str) -> Optional[dict]:
        """
        Verifica se um token JWT é válido e retorna seu conteúdo.
        
        Args:
            token: String do token JWT
            
        Returns:
            dict com o payload do token, ou None se inválido/expirado
        """
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )
            return payload
        except JWTError:
            # Token inválido, expirado ou adulterado
            return None
    
    async def get_current_user(
        self,
        token: str,
        db: AsyncSession
    ) -> Optional[Usuario]:
        """
        Busca o usuário no banco a partir de um token JWT.
        
        Fluxo:
        1. Decodifica o token JWT
        2. Extrai o ID do usuário do campo 'sub'
        3. Busca o usuário no MySQL pelo ID
        
        Args:
            token: String do token JWT
            db: Sessão assíncrona do banco de dados
            
        Returns:
            Objeto Usuario se encontrado, ou None se token inválido
        """
        # Passo 1: Decodifica o token
        payload = await self.verify_jwt_token(token)
        if not payload:
            return None
        
        # Passo 2: Extrai o ID do usuário
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # Passo 3: Busca no banco de dados
        try:
            result = await db.execute(
                select(Usuario).where(Usuario.id == int(user_id))
            )
            usuario = result.scalar_one_or_none()
            return usuario
        except:
            return None


# Instância singleton — usada em todo o backend
auth_service = AuthService()
