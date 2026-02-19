from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MySQL
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_database: str = "sistema_agendamento"
    
    # JWT
    jwt_secret_key: str = "sistema-agendamento-secret-key-2024"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # Frontend - URLs permitidas para CORS (separadas por vírgula)
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:5174"
    
    # SMTP (E-mail)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    email_from_name: str = "Sistema de Agendamento"
    
    # Microsoft Azure / Teams
    azure_client_id: str = ""
    azure_tenant_id: str = ""
    azure_client_secret: str = ""
    azure_organizer_email: str = ""
    
    @property
    def database_url(self) -> str:
        return f"mysql+aiomysql://{self.mysql_user}:{self.mysql_password}@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
