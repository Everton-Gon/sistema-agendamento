from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List
from datetime import datetime, date
from app.database import get_db, Sala, RecursoSala, Reuniao, Usuario
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


# =====================
# Schemas
# =====================
class RoomResponse(BaseModel):
    id: int
    name: str
    capacity: int
    color: str
    resources: List[str]
    is_active: bool = True
    
    class Config:
        from_attributes = True


# =====================
# Endpoints
# =====================
@router.get("/", response_model=List[RoomResponse])
async def get_rooms(
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Listar todas as salas ativas."""
    # Buscar salas com recursos
    result = await db.execute(
        select(Sala)
        .options(selectinload(Sala.recursos))
        .where(Sala.ativa == True)
        .order_by(Sala.nome)
    )
    salas = result.scalars().all()
    
    # Formatar resposta
    return [
        RoomResponse(
            id=sala.id,
            name=sala.nome,
            capacity=sala.capacidade,
            color=sala.cor,
            resources=[r.nome_recurso for r in sala.recursos],
            is_active=sala.ativa
        )
        for sala in salas
    ]


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
    room_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter uma sala específica."""
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
