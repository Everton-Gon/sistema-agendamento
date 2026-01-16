from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, DateTime, Text, Enum, ForeignKey, func
from datetime import datetime
from typing import Optional, List
from app.config import get_settings

settings = get_settings()

# Criar engine assíncrono
engine = create_async_engine(
    settings.database_url,
    echo=True,  # Mostrar SQL queries no console
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


# Base para os modelos
class Base(DeclarativeBase):
    pass


# =====================
# Modelo: Usuario
# =====================
class Usuario(Base):
    __tablename__ = "usuarios"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relacionamentos
    reunioes_organizadas: Mapped[List["Reuniao"]] = relationship(
        "Reuniao",
        back_populates="organizador",
        foreign_keys="Reuniao.organizador_id"
    )


# =====================
# Modelo: Sala
# =====================
class Sala(Base):
    __tablename__ = "salas"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    capacidade: Mapped[int] = mapped_column(Integer, nullable=False)
    cor: Mapped[str] = mapped_column(String(7), default="#3b82f6")
    ativa: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relacionamentos
    recursos: Mapped[List["RecursoSala"]] = relationship(
        "RecursoSala",
        back_populates="sala",
        cascade="all, delete-orphan"
    )
    reunioes: Mapped[List["Reuniao"]] = relationship(
        "Reuniao",
        back_populates="sala"
    )


# =====================
# Modelo: RecursoSala
# =====================
class RecursoSala(Base):
    __tablename__ = "recursos_sala"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sala_id: Mapped[int] = mapped_column(Integer, ForeignKey("salas.id", ondelete="CASCADE"), index=True)
    nome_recurso: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Relacionamentos
    sala: Mapped["Sala"] = relationship("Sala", back_populates="recursos")


# =====================
# Modelo: Reuniao
# =====================
class Reuniao(Base):
    __tablename__ = "reunioes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sala_id: Mapped[int] = mapped_column(Integer, ForeignKey("salas.id", ondelete="RESTRICT"), index=True)
    organizador_id: Mapped[int] = mapped_column(Integer, ForeignKey("usuarios.id", ondelete="RESTRICT"), index=True)
    data_hora_inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    data_hora_fim: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='agendada', index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relacionamentos
    sala: Mapped["Sala"] = relationship("Sala", back_populates="reunioes")
    organizador: Mapped["Usuario"] = relationship("Usuario", back_populates="reunioes_organizadas")
    participantes: Mapped[List["ParticipanteReuniao"]] = relationship(
        "ParticipanteReuniao",
        back_populates="reuniao",
        cascade="all, delete-orphan"
    )


# =====================
# Modelo: ParticipanteReuniao
# =====================
class ParticipanteReuniao(Base):
    __tablename__ = "participantes_reuniao"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reuniao_id: Mapped[int] = mapped_column(Integer, ForeignKey("reunioes.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    nome: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default='pendente', index=True)
    confirmation_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relacionamentos
    reuniao: Mapped["Reuniao"] = relationship("Reuniao", back_populates="participantes")


# =====================
# Funções de Inicialização
# =====================
async def init_db():
    """Inicializar banco de dados."""
    # Tabelas já foram criadas manualmente no MySQL
    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.create_all)
    
    print("✅ MySQL conectado com sucesso!")
    print(f"   Database: {settings.mysql_database}")
    
    # Criar salas padrão se não existirem
    await criar_salas_padrao()


async def criar_salas_padrao():
    """Criar as 6 salas padrão se não existirem."""
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        
        # Verificar se já existem salas
        result = await session.execute(select(func.count(Sala.id)))
        count = result.scalar()
        
        if count == 0:
            salas_padrao = [
                {
                    "nome": "Sala 02",
                    "capacidade": 4,
                    "cor": "#3b82f6",
                    "recursos": ["TV"]
                },
                {
                    "nome": "Sala 03",
                    "capacidade": 6,
                    "cor": "#8b5cf6",
                    "recursos": ["TV"]
                },
                {
                    "nome": "Sala 04",
                    "capacidade": 12,
                    "cor": "#10b981",
                    "recursos": ["TV"]
                },
                {
                    "nome": "Sala Conselho",
                    "capacidade": 5,
                    "cor": "#f59e0b",
                    "recursos": ["TV", "Webcam"]
                },
                {
                    "nome": "Showroom",
                    "capacidade": 20,
                    "cor": "#ef4444",
                    "recursos": ["TV"]
                },
                {
                    "nome": "ShowroomSP",
                    "capacidade": 8,
                    "cor": "#06b6d4",
                    "recursos": ["TV"]
                }
            ]
            
            for sala_data in salas_padrao:
                recursos = sala_data.pop("recursos")
                sala = Sala(**sala_data)
                session.add(sala)
                await session.flush()
                
                for recurso_nome in recursos:
                    recurso = RecursoSala(sala_id=sala.id, nome_recurso=recurso_nome)
                    session.add(recurso)
            
            await session.commit()
            print("✅ Criadas 6 salas de reunião padrão")


async def close_db():
    """Fechar conexão com o banco."""
    await engine.dispose()
    print("👋 Conexão MySQL fechada")


# =====================
# Dependency para obter sessão
# =====================
async def get_db() -> AsyncSession:
    """Dependency para obter sessão do banco."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
