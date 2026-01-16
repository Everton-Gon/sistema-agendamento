from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import Usuario

settings = get_settings()


class AuthService:
    """Service para autenticação."""
    
    def create_jwt_token(self, usuario: Usuario) -> str:
        """Criar JWT token para o usuário."""
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        
        to_encode = {
            "sub": str(usuario.id),
            "email": usuario.email,
            "nome": usuario.nome,
            "exp": expire
        }
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )
        
        return encoded_jwt
    
    async def verify_jwt_token(self, token: str) -> Optional[dict]:
        """Verificar e decodificar JWT token."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )
            return payload
        except JWTError:
            return None
    
    async def get_current_user(
        self,
        token: str,
        db: AsyncSession
    ) -> Optional[Usuario]:
        """Obter usuário atual a partir do JWT token."""
        payload = await self.verify_jwt_token(token)
        
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        try:
            result = await db.execute(
                select(Usuario).where(Usuario.id == int(user_id))
            )
            usuario = result.scalar_one_or_none()
            return usuario
        except:
            return None


# Singleton instance
auth_service = AuthService()
