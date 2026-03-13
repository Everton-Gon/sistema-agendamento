"""
=============================================================
  database.py — Modelos do banco de dados + Conexão MySQL
=============================================================
  Este arquivo contém:
  1. Configuração da conexão assíncrona com MySQL (SQLAlchemy)
  2. Todos os modelos (tabelas) do banco de dados
  3. Funções de inicialização (criar salas padrão)
  4. Dependency para injetar sessão do banco nas rotas
  
  Tabelas: usuarios, salas, recursos_sala, reunioes, participantes_reuniao
=============================================================
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, DateTime, Text, Enum, ForeignKey, func
from datetime import datetime
from typing import Optional, List
from app.config import get_settings

settings = get_settings()


# =============================================
# Configuração da conexão com MySQL
# =============================================

# Engine assíncrono — gerencia o pool de conexões com o banco
engine = create_async_engine(
    settings.database_url,       # URL de conexão (mysql+aiomysql://...)
    echo=True,                   # True = exibe queries SQL no console (útil para debug)
    pool_pre_ping=True,          # Verifica se a conexão está viva antes de usar
    pool_recycle=3600,           # Recicla conexões a cada 1 hora (evita timeout)
)

# Fábrica de sessões — cada requisição HTTP recebe uma sessão independente
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False       # Objetos permanecem acessíveis após commit
)


# =============================================
# Classe base para todos os modelos
# =============================================
class Base(DeclarativeBase):
    """Classe base do SQLAlchemy. Todos os modelos herdam dela."""
    pass


# =============================================
# Modelo: Usuario
# Tabela: usuarios
# =============================================
class Usuario(Base):
    """
    Representa um usuário do sistema.
    Cada usuário pode organizar múltiplas reuniões.
    """
    __tablename__ = "usuarios"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)  # E-mail único (usado no login)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)                             # Nome completo
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)                       # Senha em hash SHA-256
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)                     # Se o usuário está ativo
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())                  # Data de criação
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())  # Última atualização
    
    # Relacionamento: um usuário pode organizar várias reuniões
    reunioes_organizadas: Mapped[List["Reuniao"]] = relationship(
        "Reuniao",
        back_populates="organizador",
        foreign_keys="Reuniao.organizador_id"
    )


# =============================================
# Modelo: Sala
# Tabela: salas
# =============================================
class Sala(Base):
    """
    Representa uma sala de reunião.
    Cada sala tem nome, capacidade, cor (para o calendário) e recursos (TV, Webcam).
    """
    __tablename__ = "salas"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)                # Nome da sala ("Sala 02", "Showroom")
    capacidade: Mapped[int] = mapped_column(Integer, nullable=False)              # Quantas pessoas cabem
    cor: Mapped[str] = mapped_column(String(7), default="#3b82f6")                # Cor hex para exibir no calendário
    ativa: Mapped[bool] = mapped_column(Boolean, default=True, index=True)        # Se a sala está disponível
    outlook_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Email da sala no Outlook (Room Mailbox) para sincronização
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relacionamento: uma sala tem vários recursos (TV, Webcam, etc.)
    recursos: Mapped[List["RecursoSala"]] = relationship(
        "RecursoSala",
        back_populates="sala",
        cascade="all, delete-orphan"      # Se deletar a sala, deleta os recursos junto
    )
    
    # Relacionamento: uma sala pode ter várias reuniões
    reunioes: Mapped[List["Reuniao"]] = relationship(
        "Reuniao",
        back_populates="sala"
    )


# =============================================
# Modelo: RecursoSala
# Tabela: recursos_sala
# =============================================
class RecursoSala(Base):
    """
    Recurso disponível em uma sala (ex: TV, Webcam, Projetor).
    Cada recurso pertence a uma única sala.
    """
    __tablename__ = "recursos_sala"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sala_id: Mapped[int] = mapped_column(Integer, ForeignKey("salas.id", ondelete="CASCADE"), index=True)  # FK para a sala
    nome_recurso: Mapped[str] = mapped_column(String(100), nullable=False)    # Nome do recurso ("TV", "Webcam")
    
    # Relacionamento inverso: pertence a uma sala
    sala: Mapped["Sala"] = relationship("Sala", back_populates="recursos")


# =============================================
# Modelo: Reuniao
# Tabela: reunioes
# =============================================
class Reuniao(Base):
    """
    Representa uma reunião agendada.
    Contém título, descrição, sala, organizador, horários,
    link do Teams e status (agendada/cancelada/concluida).
    """
    __tablename__ = "reunioes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)                                      # Título da reunião
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)                                  # Descrição (opcional)
    sala_id: Mapped[int] = mapped_column(Integer, ForeignKey("salas.id", ondelete="RESTRICT"), index=True) # FK para a sala
    organizador_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id", ondelete="RESTRICT"), index=True)  # FK para o organizador
    data_hora_inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)               # Início da reunião
    data_hora_fim: Mapped[datetime] = mapped_column(DateTime, nullable=False)                              # Fim da reunião
    status: Mapped[str] = mapped_column(String(20), default='agendada', index=True)                        # agendada | cancelada | concluida
    teams_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)                          # Link do Microsoft Teams (se habilitado)
    teams_event_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)                      # ID do evento no Outlook (para cancelamento)
    recorrente: Mapped[bool] = mapped_column(default=False)                                                # Se é reunião recorrente
    padrao_recorrencia: Mapped[Optional[str]] = mapped_column(Text, nullable=True)                         # JSON: {"frequency":"weekly","days":[1,3],"end_date":"2026-04-30"}
    grupo_recorrencia: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)        # UUID que agrupa todas as ocorrências de uma série
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relacionamento: pertence a uma sala
    sala: Mapped["Sala"] = relationship("Sala", back_populates="reunioes")
    
    # Relacionamento: pertence a um organizador (usuário)
    organizador: Mapped["Usuario"] = relationship("Usuario", back_populates="reunioes_organizadas")
    
    # Relacionamento: tem vários participantes
    participantes: Mapped[List["ParticipanteReuniao"]] = relationship(
        "ParticipanteReuniao",
        back_populates="reuniao",
        cascade="all, delete-orphan"      # Se deletar a reunião, deleta os participantes junto
    )


# =============================================
# Modelo: ParticipanteReuniao
# Tabela: participantes_reuniao
# =============================================
class ParticipanteReuniao(Base):
    """
    Representa um participante convidado para uma reunião.
    Cada participante tem um token único para confirmar/recusar via e-mail.
    
    Status possíveis: pendente | confirmado | recusado
    """
    __tablename__ = "participantes_reuniao"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reuniao_id: Mapped[int] = mapped_column(Integer, ForeignKey("reunioes.id", ondelete="CASCADE"), index=True)  # FK para a reunião
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)                  # E-mail do participante
    nome: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)                      # Nome (opcional)
    status: Mapped[str] = mapped_column(String(20), default='pendente', index=True)              # pendente | confirmado | recusado
    confirmation_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True, index=True)  # Token único para confirmação via e-mail
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relacionamento inverso: pertence a uma reunião
    reuniao: Mapped["Reuniao"] = relationship("Reuniao", back_populates="participantes")


# =============================================
# Funções de Inicialização do Banco
# =============================================
async def init_db():
    """
    Inicializa o banco de dados MySQL.
    Chamada automaticamente quando a API inicia (via main.py lifespan).
    - Verifica a conexão com o MySQL
    - Cria as 6 salas padrão se o banco estiver vazio
    """
    print("[OK] MySQL conectado com sucesso!")
    print(f"   Database: {settings.mysql_database}")
    await criar_salas_padrao()


async def criar_salas_padrao():
    """
    Cria as 6 salas de reunião padrão caso a tabela esteja vazia.
    Cada sala tem nome, capacidade, cor (para o calendário) e recursos.
    Esta função só executa se não existir nenhuma sala no banco.
    """
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        
        # Verifica se já existem salas cadastradas
        result = await session.execute(select(func.count(Sala.id)))
        count = result.scalar()
        
        if count == 0:
            # Lista das 6 salas padrão da empresa
            salas_padrao = [
                {"nome": "Sala 02",        "capacidade": 4,  "cor": "#3b82f6", "recursos": ["TV"]},
                {"nome": "Sala 03",        "capacidade": 6,  "cor": "#8b5cf6", "recursos": ["TV"]},
                {"nome": "Sala 04",        "capacidade": 12, "cor": "#10b981", "recursos": ["TV"]},
                {"nome": "Sala Conselho",  "capacidade": 5,  "cor": "#f59e0b", "recursos": ["TV", "Webcam"]},
                {"nome": "Showroom",       "capacidade": 20, "cor": "#ef4444", "recursos": ["TV"]},
                {"nome": "ShowroomSP",     "capacidade": 8,  "cor": "#06b6d4", "recursos": ["TV"]},
            ]
            
            for sala_data in salas_padrao:
                recursos = sala_data.pop("recursos")
                sala = Sala(**sala_data)
                session.add(sala)
                await session.flush()  # Gera o ID da sala antes de criar os recursos
                
                # Cria os recursos de cada sala
                for recurso_nome in recursos:
                    recurso = RecursoSala(sala_id=sala.id, nome_recurso=recurso_nome)
                    session.add(recurso)
            
            await session.commit()
            print("[OK] Criadas 6 salas de reuniao padrao")


async def close_db():
    """
    Fecha o pool de conexões com o MySQL.
    Chamada automaticamente quando a API é encerrada.
    """
    await engine.dispose()
    print("[*] Conexao MySQL fechada")


# =============================================
# Dependency para injeção de sessão do banco
# =============================================
async def get_db() -> AsyncSession:
    """
    Dependency do FastAPI que fornece uma sessão do banco de dados.
    
    Uso nas rotas:
        async def minha_rota(db: AsyncSession = Depends(get_db)):
            resultado = await db.execute(...)
    
    A sessão é criada no início da requisição e fechada automaticamente no final.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
