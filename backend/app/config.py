"""
=============================================================
  config.py — Configurações da aplicação
=============================================================
  Carrega variáveis de ambiente do arquivo .env usando Pydantic.
  Cada variável aqui tem um valor padrão caso não esteja no .env.
  
  Para alterar configurações, edite o arquivo backend/.env
=============================================================
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from urllib.parse import quote_plus


class Settings(BaseSettings):
    """
    Classe de configurações do sistema.
    Cada atributo corresponde a uma variável de ambiente no .env.
    """
    
    # ==========================================
    # MySQL — Configurações do banco de dados
    # ==========================================
    mysql_host: str = "localhost"              # Endereço do servidor MySQL
    mysql_port: int = 3306                     # Porta padrão do MySQL
    mysql_user: str = "root"                   # Usuário do banco
    mysql_password: str = ""                   # Senha do banco
    mysql_database: str = "sistema_agendamento"  # Nome do banco de dados
    
    # ==========================================
    # JWT — Autenticação por token
    # ==========================================
    jwt_secret_key: str = "sistema-agendamento-secret-key-2024"  # Chave para assinar tokens
    jwt_algorithm: str = "HS256"               # Algoritmo de criptografia
    access_token_expire_minutes: int = 60      # Token expira em 60 min
    
    # ==========================================
    # Frontend — URL para CORS e links de e-mail
    # ==========================================
    frontend_url: str = "https://malloryapp.com.br"  # URL do frontend React
    
    # ==========================================
    # SMTP — Configurações de envio de e-mail
    # ==========================================
    smtp_host: str = "smtp.gmail.com"          # Servidor SMTP (Gmail/Outlook)
    smtp_port: int = 587                       # Porta TLS
    smtp_user: str = ""                        # E-mail de envio
    smtp_password: str = ""                    # Senha do e-mail
    email_from: str = ""                       # Remetente (pode ser = smtp_user)
    email_from_name: str = "Sistema de Agendamento"  # Nome exibido no e-mail
    
    # ==========================================
    # Microsoft Azure / Teams — Integração
    # ==========================================
    azure_client_id: str = ""                  # ID da aplicação no Azure AD
    azure_tenant_id: str = ""                  # ID do tenant (organização)
    azure_client_secret: str = ""              # Chave secreta da aplicação
    azure_organizer_email: str = ""            # E-mail do organizador (calendário)
    
    @property
    def database_url(self) -> str:
        """
        Monta a URL de conexão com MySQL no formato SQLAlchemy.
        Usa o driver aiomysql para conexões assíncronas.
        Exemplo: mysql+aiomysql://root:senha@localhost:3306/sistema_agendamento
        """
        password = quote_plus(self.mysql_password)  # Encode especialmente o @ e outros caracteres especiais
        return f"mysql+aiomysql://{self.mysql_user}:{password}@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
    
    class Config:
        env_file = ".env"              # Arquivo de onde carregar as variáveis
        env_file_encoding = "utf-8"    # Codificação do arquivo
        extra = "ignore"               # Ignora variáveis extras no .env


@lru_cache()
def get_settings() -> Settings:
    """
    Retorna instância única das configurações (singleton).
    O decorador @lru_cache garante que o .env é lido apenas uma vez.
    """
    return Settings()
