"""
=============================================================
  rooms.py — Rotas de salas de reunião
=============================================================
  Endpoints:
  - GET /api/rooms/      → Listar todas as salas ativas
  - GET /api/rooms/{id}  → Detalhes de uma sala específica
  
  Todas as rotas exigem autenticação (token JWT).
=============================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List
from datetime import datetime, date
from app.database import get_db, Sala, RecursoSala, Reuniao, Usuario
from app.routes.auth import get_current_user

# Router com prefixo /api/rooms
router = APIRouter(prefix="/api/rooms", tags=["rooms"])


# =============================================
# Schemas Pydantic
# =============================================
class RoomResponse(BaseModel):
    """Dados de uma sala retornados pela API."""
    id: int                       # ID da sala no banco
    name: str                     # Nome da sala ("Sala 02", "Showroom")
    capacity: int                 # Capacidade máxima de pessoas
    color: str                    # Cor hex para exibir no calendário
    resources: List[str]          # Lista de recursos ("TV", "Webcam")
    is_active: bool = True        # Se a sala está disponível
    outlook_email: str = None     # Email Outlook da sala (Room Mailbox)
    
    class Config:
        from_attributes = True


# =============================================
# GET /api/rooms/ — Listar salas ativas
# =============================================
@router.get("/", response_model=List[RoomResponse])
async def get_rooms(
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista todas as salas de reunião ativas.
    
    Retorna as salas ordenadas por nome, incluindo seus recursos.
    Usado pelo frontend no formulário de nova reunião e na página de salas.
    """
    # Busca salas com seus recursos (eager loading via selectinload)
    result = await db.execute(
        select(Sala)
        .options(selectinload(Sala.recursos))    # Carrega recursos junto com a sala
        .where(Sala.ativa == True)                # Apenas salas ativas
        .order_by(Sala.nome)                      # Ordenado por nome
    )
    salas = result.scalars().all()
    
    # Converte modelos SQLAlchemy para schema Pydantic
    return [
        RoomResponse(
            id=sala.id,
            name=sala.nome,
            capacity=sala.capacidade,
            color=sala.cor,
            resources=[r.nome_recurso for r in sala.recursos],
            is_active=sala.ativa,
            outlook_email=sala.outlook_email
        )
        for sala in salas
    ]


# =============================================
# GET /api/rooms/{room_id} — Detalhes de uma sala
# =============================================
@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
    room_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os detalhes de uma sala específica pelo ID.
    
    Args:
        room_id: ID da sala no banco de dados
        
    Returns:
        Dados da sala com recursos, ou 404 se não encontrada
    """
    result = await db.execute(
        select(Sala)
        .options(selectinload(Sala.recursos))
        .where(Sala.id == room_id)
    )
    sala = result.scalar_one_or_none()
    
    if not sala:
        raise HTTPException(status_code=404, detail="Sala não encontrada")
    
    return RoomResponse(
        id=sala.id,
        name=sala.nome,
        capacity=sala.capacidade,
        color=sala.cor,
        resources=[r.nome_recurso for r in sala.recursos],
        is_active=sala.ativa
    )
