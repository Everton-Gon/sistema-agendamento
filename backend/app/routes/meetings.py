from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import secrets
from app.database import get_db, Reuniao, Sala, RecursoSala, ParticipanteReuniao, Usuario
from app.routes.auth import get_current_user
from app.services.email_service import email_service

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

# Router público para confirmação de presença (sem autenticação)
public_router = APIRouter(prefix="/api/meeting-confirmation", tags=["meeting-confirmation"])

# Armazenamento de tokens de confirmação (em produção usar Redis ou banco)
meeting_confirmation_tokens = {}


# =====================
# Schemas
# =====================
class AttendeeModel(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    status: str = "pending"


class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    room_id: int
    attendees: List[AttendeeModel] = []
    start_datetime: str
    end_datetime: str
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None


class MeetingResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    room_id: int
    room_name: Optional[str]
    room_color: Optional[str]
    organizer_id: int
    organizer_email: str
    organizer_name: str
    attendees: List[dict]
    start_datetime: str
    end_datetime: str
    is_recurring: bool
    recurrence_pattern: Optional[str]
    status: str
    created_at: str


# =====================
# Endpoints
# =====================
@router.get("/")
async def get_meetings(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter reuniões do usuário atual."""
    query = select(Reuniao).options(
        selectinload(Reuniao.sala),
        selectinload(Reuniao.participantes)
    ).where(
        Reuniao.organizador_id == current_user.id,
        Reuniao.status == 'agendada'
    ).order_by(Reuniao.data_hora_inicio)
    
    result = await db.execute(query)
    reunioes = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "title": r.titulo,
            "description": r.descricao,
            "room_id": r.sala_id,
            "room_name": r.sala.nome if r.sala else None,
            "room_color": r.sala.cor if r.sala else None,
            "organizer_id": r.organizador_id,
            "organizer_email": current_user.email,
            "organizer_name": current_user.nome,
            "attendees": [
                {"email": p.email, "name": p.nome, "status": p.status}
                for p in r.participantes
            ],
            "start_datetime": r.data_hora_inicio.isoformat(),
            "end_datetime": r.data_hora_fim.isoformat(),
            "is_recurring": False,
            "recurrence_pattern": None,
            "status": r.status,
            "created_at": r.criado_em.isoformat()
        }
        for r in reunioes
    ]


@router.get("/calendar")
async def get_calendar_events(
    start: str = Query(...),
    end: str = Query(...),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter eventos do calendário (todas as reuniões)."""
    start_dt = datetime.fromisoformat(start.replace('Z', '+00:00')) if 'Z' in start else datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end.replace('Z', '+00:00')) if 'Z' in end else datetime.fromisoformat(end)
    
    result = await db.execute(
        select(Reuniao).options(
            selectinload(Reuniao.sala),
            selectinload(Reuniao.organizador)
        ).where(
            Reuniao.status == 'agendada',
            Reuniao.data_hora_inicio >= start_dt,
            Reuniao.data_hora_inicio <= end_dt
        ).order_by(Reuniao.data_hora_inicio)
    )
    reunioes = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "title": r.titulo,
            "start": r.data_hora_inicio.isoformat(),
            "end": r.data_hora_fim.isoformat(),
            "room_id": r.sala_id,
            "room_name": r.sala.nome if r.sala else "Sala",
            "room_color": r.sala.cor if r.sala else "#6366F1",
            "organizer_name": r.organizador.nome if r.organizador else "Organizador",
            "is_own_meeting": r.organizador_id == current_user.id
        }
        for r in reunioes
    ]


@router.post("/", status_code=201)
async def create_meeting(
    meeting_data: MeetingCreate,
    background_tasks: BackgroundTasks,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Criar nova reunião."""
    # Parse datas
    start_dt = datetime.fromisoformat(meeting_data.start_datetime)
    end_dt = datetime.fromisoformat(meeting_data.end_datetime)
    
    # Buscar sala
    result = await db.execute(
        select(Sala).options(selectinload(Sala.recursos)).where(Sala.id == meeting_data.room_id)
    )
    sala = result.scalar_one_or_none()
    
    if not sala:
        raise HTTPException(status_code=404, detail="Sala não encontrada")
    
    # Verificar conflitos
    conflict_result = await db.execute(
        select(Reuniao).where(
            Reuniao.sala_id == meeting_data.room_id,
            Reuniao.status == 'agendada',
            Reuniao.data_hora_inicio < end_dt,
            Reuniao.data_hora_fim > start_dt
        )
    )
    conflict = conflict_result.scalar_one_or_none()
    
    if conflict:
        # Buscar salas disponíveis
        all_rooms_result = await db.execute(
            select(Sala).options(selectinload(Sala.recursos)).where(Sala.ativa == True)
        )
        all_rooms = all_rooms_result.scalars().all()
        
        available_rooms = []
        for r in all_rooms:
            if r.id == meeting_data.room_id:
                continue
            room_conflict = await db.execute(
                select(Reuniao).where(
                    Reuniao.sala_id == r.id,
                    Reuniao.status == 'agendada',
                    Reuniao.data_hora_inicio < end_dt,
                    Reuniao.data_hora_fim > start_dt
                )
            )
            if room_conflict.scalar_one_or_none() is None:
                available_rooms.append({
                    "id": r.id,
                    "name": r.nome,
                    "capacity": r.capacidade,
                    "color": r.cor
                })
        
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"A sala '{sala.nome}' já está reservada neste horário.",
                "conflict": {
                    "title": conflict.titulo,
                    "start": conflict.data_hora_inicio.isoformat(),
                    "end": conflict.data_hora_fim.isoformat()
                },
                "available_rooms": available_rooms
            }
        )
    
    # Criar reunião
    reuniao = Reuniao(
        titulo=meeting_data.title,
        descricao=meeting_data.description,
        sala_id=meeting_data.room_id,
        organizador_id=current_user.id,
        data_hora_inicio=start_dt,
        data_hora_fim=end_dt,
        status='agendada'
    )
    db.add(reuniao)
    await db.flush()
    
    # Adicionar participantes com token de confirmação
    tokens_participantes = []
    for att in meeting_data.attendees:
        confirmation_token = secrets.token_urlsafe(32)
        participante = ParticipanteReuniao(
            reuniao_id=reuniao.id,
            email=att.email,
            nome=att.name,
            status='pendente',
            confirmation_token=confirmation_token
        )
        db.add(participante)
        tokens_participantes.append({
            "email": att.email,
            "name": att.name,
            "token": confirmation_token
        })
    
    await db.commit()
    await db.refresh(reuniao)
    
    # Enviar e-mails para os participantes em background
    for att_info in tokens_participantes:
        background_tasks.add_task(
            email_service.send_meeting_invitation,
            to_email=att_info["email"],
            participant_name=att_info["name"],
            meeting_title=meeting_data.title,
            meeting_id=reuniao.id,
            meeting_date=start_dt,
            meeting_start=start_dt.strftime("%H:%M"),
            meeting_end=end_dt.strftime("%H:%M"),
            room_name=sala.nome,
            organizer_name=current_user.nome,
            organizer_email=current_user.email,
            confirmation_token=att_info["token"],
            description=meeting_data.description
        )
    
    return {
        "id": reuniao.id,
        "title": reuniao.titulo,
        "description": reuniao.descricao,
        "room_id": reuniao.sala_id,
        "room_name": sala.nome,
        "room_color": sala.cor,
        "organizer_id": reuniao.organizador_id,
        "organizer_email": current_user.email,
        "organizer_name": current_user.nome,
        "attendees": [{"email": a.email, "name": a.name, "status": "pending"} for a in meeting_data.attendees],
        "start_datetime": reuniao.data_hora_inicio.isoformat(),
        "end_datetime": reuniao.data_hora_fim.isoformat(),
        "is_recurring": False,
        "recurrence_pattern": None,
        "status": reuniao.status,
        "created_at": reuniao.criado_em.isoformat()
    }


@router.get("/check-availability")
async def check_availability(
    room_id: int,
    start: str,
    end: str,
    meeting_id: Optional[int] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verificar disponibilidade de horário."""
    start_dt = datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end)
    
    # Verificar conflitos
    query = select(Reuniao).where(
        Reuniao.sala_id == room_id,
        Reuniao.status == 'agendada',
        Reuniao.data_hora_inicio < end_dt,
        Reuniao.data_hora_fim > start_dt
    )
    
    if meeting_id:
        query = query.where(Reuniao.id != meeting_id)
    
    result = await db.execute(query)
    conflict = result.scalar_one_or_none()
    
    response = {
        "is_available": conflict is None,
        "room_id": room_id,
        "start": start,
        "end": end
    }
    
    if conflict:
        # Buscar sala
        sala_result = await db.execute(select(Sala).where(Sala.id == room_id))
        sala = sala_result.scalar_one_or_none()
        
        # Buscar salas disponíveis
        all_rooms_result = await db.execute(
            select(Sala).options(selectinload(Sala.recursos)).where(Sala.ativa == True)
        )
        all_rooms = all_rooms_result.scalars().all()
        
        available_rooms = []
        for r in all_rooms:
            if r.id == room_id:
                continue
            room_conflict = await db.execute(
                select(Reuniao).where(
                    Reuniao.sala_id == r.id,
                    Reuniao.status == 'agendada',
                    Reuniao.data_hora_inicio < end_dt,
                    Reuniao.data_hora_fim > start_dt
                )
            )
            if room_conflict.scalar_one_or_none() is None:
                available_rooms.append({
                    "id": r.id,
                    "name": r.nome,
                    "capacity": r.capacidade,
                    "color": r.cor,
                    "resources": [rec.nome_recurso for rec in r.recursos]
                })
        
        response["conflict"] = {
            "message": f"A sala '{sala.nome if sala else 'selecionada'}' já está reservada neste horário.",
            "meeting": {
                "title": conflict.titulo,
                "start": conflict.data_hora_inicio.isoformat(),
                "end": conflict.data_hora_fim.isoformat()
            }
        }
        response["available_rooms"] = available_rooms
    
    return response


@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter reunião específica."""
    result = await db.execute(
        select(Reuniao).options(
            selectinload(Reuniao.sala),
            selectinload(Reuniao.participantes),
            selectinload(Reuniao.organizador)
        ).where(Reuniao.id == meeting_id)
    )
    reuniao = result.scalar_one_or_none()
    
    if not reuniao:
        raise HTTPException(status_code=404, detail="Reunião não encontrada")
    
    return {
        "id": reuniao.id,
        "title": reuniao.titulo,
        "description": reuniao.descricao,
        "room_id": reuniao.sala_id,
        "room_name": reuniao.sala.nome if reuniao.sala else None,
        "room_color": reuniao.sala.cor if reuniao.sala else None,
        "organizer_id": reuniao.organizador_id,
        "organizer_email": reuniao.organizador.email if reuniao.organizador else None,
        "organizer_name": reuniao.organizador.nome if reuniao.organizador else None,
        "attendees": [
            {"email": p.email, "name": p.nome, "status": p.status}
            for p in reuniao.participantes
        ],
        "start_datetime": reuniao.data_hora_inicio.isoformat(),
        "end_datetime": reuniao.data_hora_fim.isoformat(),
        "is_recurring": False,
        "recurrence_pattern": None,
        "status": reuniao.status,
        "created_at": reuniao.criado_em.isoformat()
    }


@router.delete("/{meeting_id}")
async def cancel_meeting(
    meeting_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancelar reunião."""
    result = await db.execute(
        select(Reuniao).where(Reuniao.id == meeting_id)
    )
    reuniao = result.scalar_one_or_none()
    
    if not reuniao:
        raise HTTPException(status_code=404, detail="Reunião não encontrada")
    
    if reuniao.organizador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o organizador pode cancelar")
    
    reuniao.status = "cancelada"
    await db.commit()
    
    return {"message": "Reunião cancelada com sucesso"}


@public_router.post("/respond")
async def respond_to_meeting(
    token: str,
    response: str,
    db: AsyncSession = Depends(get_db)
):
    """Responder ao convite de reunião (aceitar/recusar)."""
    # Buscar participante pelo token no banco
    result = await db.execute(
        select(ParticipanteReuniao).options(
            selectinload(ParticipanteReuniao.reuniao)
        ).where(ParticipanteReuniao.confirmation_token == token)
    )
    participante = result.scalar_one_or_none()
    
    if not participante:
        raise HTTPException(
            status_code=400,
            detail="Token inválido ou já utilizado"
        )
    
    meeting_title = participante.reuniao.titulo if participante.reuniao else "Reunião"
    
    # Atualizar status
    if response == "accept":
        participante.status = "aceito"
        status_text = "aceita"
    else:
        participante.status = "recusado"
        status_text = "recusada"
    
    # Limpar token após uso (opcional - previne reuso)
    participante.confirmation_token = None
    
    await db.commit()
    
    return {
        "message": f"Sua resposta foi registrada com sucesso!",
        "meeting_title": meeting_title,
        "response": response,
        "status_text": status_text
    }


@public_router.get("/respond-info")
async def get_meeting_response_info(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Obter informações do convite pelo token."""
    # Buscar participante pelo token no banco
    result = await db.execute(
        select(ParticipanteReuniao).options(
            selectinload(ParticipanteReuniao.reuniao).selectinload(Reuniao.sala),
            selectinload(ParticipanteReuniao.reuniao).selectinload(Reuniao.organizador)
        ).where(ParticipanteReuniao.confirmation_token == token)
    )
    participante = result.scalar_one_or_none()
    
    if not participante:
        raise HTTPException(
            status_code=400,
            detail="Token inválido ou já utilizado"
        )
    
    reuniao = participante.reuniao
    
    if not reuniao:
        raise HTTPException(status_code=404, detail="Reunião não encontrada")
    
    return {
        "meeting_title": reuniao.titulo,
        "meeting_date": reuniao.data_hora_inicio.strftime("%d/%m/%Y"),
        "meeting_start": reuniao.data_hora_inicio.strftime("%H:%M"),
        "meeting_end": reuniao.data_hora_fim.strftime("%H:%M"),
        "room_name": reuniao.sala.nome if reuniao.sala else "Sala",
        "organizer_name": reuniao.organizador.nome if reuniao.organizador else "Organizador",
        "participant_email": participante.email
    }


@router.get("/confirm", response_class=HTMLResponse)
async def confirm_meeting_attendance(
    token: str,
    response: str,
    db: AsyncSession = Depends(get_db)
):
    """Confirmar presença via link do e-mail - retorna HTML diretamente."""
    
    # Verificar token
    token_data = meeting_confirmation_tokens.get(token)
    
    if not token_data:
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Link Inválido</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
                .icon { width: 80px; height: 80px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 40px; }
                h2 { margin: 0 0 10px; color: #333; }
                p { color: #666; margin: 0; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">⚠️</div>
                <h2>Link Inválido</h2>
                <p>Este link já foi utilizado ou expirou.</p>
            </div>
        </body>
        </html>
        """, status_code=400)
    
    meeting_id = token_data["meeting_id"]
    email = token_data["email"]
    meeting_title = token_data["meeting_title"]
    
    # Buscar participante
    result = await db.execute(
        select(ParticipanteReuniao).where(
            ParticipanteReuniao.reuniao_id == meeting_id,
            ParticipanteReuniao.email == email
        )
    )
    participante = result.scalar_one_or_none()
    
    if not participante:
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Erro</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
                .icon { width: 80px; height: 80px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 40px; }
                h2 { margin: 0 0 10px; color: #333; }
                p { color: #666; margin: 0; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">❌</div>
                <h2>Participante não encontrado</h2>
                <p>Não foi possível processar sua resposta.</p>
            </div>
        </body>
        </html>
        """, status_code=404)
    
    # Atualizar status
    is_accepted = response == "accept"
    if is_accepted:
        participante.status = "aceito"
    else:
        participante.status = "recusado"
    
    await db.commit()
    
    # Remover token usado
    del meeting_confirmation_tokens[token]
    
    # Retornar página HTML de confirmação
    if is_accepted:
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Presença Confirmada!</title>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }}
                .card {{ background: white; border-radius: 16px; padding: 40px; max-width: 450px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }}
                .icon {{ width: 80px; height: 80px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 40px; }}
                h2 {{ margin: 0 0 10px; color: #333; }}
                p {{ color: #666; margin: 10px 0; }}
                .meeting {{ background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; }}
                .close {{ color: #999; font-size: 13px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">✅</div>
                <h2>Presença Confirmada!</h2>
                <p>Você confirmou presença na reunião:</p>
                <div class="meeting"><strong>{meeting_title}</strong></div>
                <p>O organizador será notificado.</p>
                <p class="close">Você pode fechar esta página.</p>
            </div>
        </body>
        </html>
        """)
    else:
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Convite Recusado</title>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }}
                .card {{ background: white; border-radius: 16px; padding: 40px; max-width: 450px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }}
                .icon {{ width: 80px; height: 80px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 40px; }}
                h2 {{ margin: 0 0 10px; color: #333; }}
                p {{ color: #666; margin: 10px 0; }}
                .meeting {{ background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0; }}
                .close {{ color: #999; font-size: 13px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">❌</div>
                <h2>Convite Recusado</h2>
                <p>Você recusou o convite para a reunião:</p>
                <div class="meeting"><strong>{meeting_title}</strong></div>
                <p>O organizador será notificado.</p>
                <p class="close">Você pode fechar esta página.</p>
            </div>
        </body>
        </html>
        """)
