"""
=============================================================
  meetings.py — Rotas de reuniões (CRUD + Confirmação)
=============================================================
  Rotas autenticadas (router - /api/meetings):
  - GET    /api/meetings/                → Listar reuniões do usuário
  - GET    /api/meetings/calendar        → Eventos para o calendário
  - POST   /api/meetings/               → Criar nova reunião
  - GET    /api/meetings/check-availability → Verificar conflitos
  - GET    /api/meetings/{id}           → Detalhes de uma reunião
  - DELETE /api/meetings/{id}           → Cancelar reunião
  
  Rotas públicas (public_router - /api/meeting-confirmation):
  - POST   /api/meeting-confirmation/respond      → Aceitar/recusar convite
  - GET    /api/meeting-confirmation/respond-info  → Info do convite pelo token
  - GET    /api/meetings/confirm                   → Confirmação via link HTML
  
  Fluxo de criação de reunião:
  1. Valida sala e verifica conflitos de horário
  2. Cria o registro no banco + participantes com tokens
  3. Cria evento no calendário Outlook/Teams (se Azure configurado)
  4. Envia e-mails de convite com botões aceitar/recusar
=============================================================
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta, timezone

# Fuso horário de Brasília (UTC-3) — usado para normalizar datas do Outlook
BRASILIA = timezone(timedelta(hours=-3))
import secrets
import uuid
import json
import asyncio
from app.database import get_db, Reuniao, Sala, RecursoSala, ParticipanteReuniao, Usuario
from app.routes.auth import get_current_user
from app.services.email_service import email_service
from app.services.graph_service import graph_service

# Router autenticado — todas as rotas exigem JWT
router = APIRouter(prefix="/api/meetings", tags=["meetings"])

# Router público — para confirmação de presença via link do e-mail
public_router = APIRouter(prefix="/api/meeting-confirmation", tags=["meeting-confirmation"])

# Armazenamento temporário de tokens de confirmação por link direto
# NOTA: Em produção, usar Redis ou banco de dados
meeting_confirmation_tokens = {}


def _to_brasilia_naive(dt_str: str) -> datetime | None:
    """
    Converte string de data do Outlook para datetime naive no horário de Brasília.

    A Microsoft pode retornar horários em formatos variados:
      - "2026-04-09T12:30:00Z"        → UTC com sufixo Z
      - "2026-04-09T09:30:00-03:00"   → com offset explícito
      - "2026-04-09T09:30:00"         → sem fuso (já naive)

    Para comparar corretamente com horários do usuário (sempre BRT),
    converte qualquer formato para BRT e então remove o tzinfo.
    """
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            # Converte para Brasília ANTES de remover o fuso
            return dt.astimezone(BRASILIA).replace(tzinfo=None)
        return dt  # já é naive — assume que está em BRT
    except (ValueError, TypeError):
        return None


# =============================================
# Schemas Pydantic (validação de entrada/saída)
# =============================================
class AttendeeModel(BaseModel):
    """Dados de um participante convidado."""
    email: EmailStr              # E-mail do participante
    name: Optional[str] = None   # Nome (opcional)
    status: str = "pending"      # Status inicial


class MeetingCreate(BaseModel):
    """Dados necessários para criar uma nova reunião."""
    title: str                                   # Título da reunião
    description: Optional[str] = None            # Descrição (opcional)
    room_id: int                                 # ID da sala escolhida
    attendees: List[AttendeeModel] = []          # Lista de participantes
    start_datetime: str                          # Início (ISO 8601: "2024-01-15T14:00:00")
    end_datetime: str                            # Fim (ISO 8601: "2024-01-15T15:00:00")
    is_recurring: bool = False                   # Se é recorrente
    recurrence_frequency: Optional[str] = None   # daily | weekly | biweekly | monthly
    recurrence_days: Optional[List[int]] = None  # Dias da semana (0=seg, 1=ter, ..., 4=sex)
    recurrence_end_date: Optional[str] = None    # Data final da recorrência (yyyy-MM-dd)


class MeetingUpdate(BaseModel):
    """Dados para atualizar uma reunião existente (todos opcionais)."""
    title: Optional[str] = None
    description: Optional[str] = None
    room_id: Optional[int] = None
    attendees: Optional[List[AttendeeModel]] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None


class MeetingResponse(BaseModel):
    """Dados da reunião retornados pela API."""
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


# =============================================
# GET /api/meetings/ — Listar reuniões do usuário
# =============================================
@router.get("/")
async def get_meetings(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista todas as reuniões agendadas do usuário logado.
    
    Retorna apenas reuniões com status 'agendada' organizadas pelo 
    usuário atual, ordenadas por data de início.
    Usado na página "Minhas Reuniões" do frontend.
    """
    query = select(Reuniao).options(
        selectinload(Reuniao.sala),            # Carrega dados da sala
        selectinload(Reuniao.participantes)     # Carrega lista de participantes
    ).where(
        Reuniao.organizador_id == current_user.id,   # Apenas do usuário logado
        Reuniao.status == 'agendada'                  # Apenas ativas
    ).order_by(Reuniao.data_hora_inicio)              # Ordena por data
    
    result = await db.execute(query)
    reunioes = result.scalars().all()
    
    # Converte para formato JSON do frontend
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
            "teams_link": r.teams_link,
            "created_at": r.criado_em.isoformat()
        }
        for r in reunioes
    ]


# =============================================
# GET /api/meetings/calendar — Eventos do calendário
# =============================================
@router.get("/calendar")
async def get_calendar_events(
    start: str = Query(...),
    end: str = Query(...),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna todas as reuniões agendadas no período para exibir no calendário.
    
    Combina reuniões locais (do banco) + eventos do Outlook (das salas com
    outlook_email configurado). Cada evento tem campo 'source'.
    """
    # Parse das datas (suporta formato com 'Z' ou sem)
    start_dt = datetime.fromisoformat(start.replace('Z', '+00:00')) if 'Z' in start else datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end.replace('Z', '+00:00')) if 'Z' in end else datetime.fromisoformat(end)
    
    # === 1. Reuniões LOCAIS ===
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
    
    events = []
    local_times = set()  # Para deduplicação
    
    for r in reunioes:
        s_iso = r.data_hora_inicio.isoformat()
        e_iso = r.data_hora_fim.isoformat()
        local_times.add((r.sala_id, s_iso[:16], e_iso[:16]))
        
        events.append({
            "id": r.id,
            "title": r.titulo,
            "start": s_iso,
            "end": e_iso,
            "room_id": r.sala_id,
            "room_name": r.sala.nome if r.sala else "Sala",
            "room_color": r.sala.cor if r.sala else "#6366F1",
            "organizer_name": r.organizador.nome if r.organizador else "Organizador",
            "is_own_meeting": r.organizador_id == current_user.id,
            "teams_link": r.teams_link,
            "source": "local"
        })
    
    # === 2. Eventos do OUTLOOK (todas as salas em PARALELO com asyncio.gather) ===
    try:
        salas_result = await db.execute(
            select(Sala).where(Sala.ativa == True, Sala.outlook_email != None)
        )
        salas_outlook = salas_result.scalars().all()
        
        if salas_outlook:
            # Sem timezone para o Graph API
            start_naive = start_dt.replace(tzinfo=None) if start_dt.tzinfo else start_dt
            end_naive = end_dt.replace(tzinfo=None) if end_dt.tzinfo else end_dt
            
            # ── PARALELO: dispara todas as salas ao mesmo tempo ──────────────────
            # Agora: sala1 + sala2 + sala3 simultâneas          (tempo da mais lenta)
            tasks = [
                graph_service.get_room_calendar_events(sala.outlook_email, start_naive, end_naive)
                for sala in salas_outlook
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            # ─────────────────────────────────────────────────────────────────────

            for sala, outlook_events in zip(salas_outlook, results):
                # Se esta sala deu erro, pula sem quebrar a consulta das outras
                if isinstance(outlook_events, Exception):
                    print(f"[WARN] Erro ao buscar Outlook para {sala.nome}: {outlook_events}")
                    continue
                
                for evt in outlook_events:
                    evt_start = evt.get("start", {}).get("dateTime", "")
                    evt_end = evt.get("end", {}).get("dateTime", "")
                    
                    # Deduplicação
                    if (sala.id, evt_start[:16], evt_end[:16]) in local_times:
                        continue
                    
                    try:
                        s_dt = datetime.fromisoformat(evt_start)
                        e_dt = datetime.fromisoformat(evt_end)
                    except (ValueError, TypeError):
                        continue
                    
                    organizer_info = evt.get("organizer", {}).get("emailAddress", {})
                    
                    events.append({
                        "id": None,
                        "title": evt.get("subject", "Reunião Outlook"),
                        "start": s_dt.isoformat(),
                        "end": e_dt.isoformat(),
                        "room_id": sala.id,
                        "room_name": sala.nome,
                        "room_color": sala.cor or "#6366f1",
                        "organizer_name": organizer_info.get("name", ""),
                        "is_own_meeting": False,
                        "teams_link": None,
                        "source": "outlook"
                    })
    except Exception as e:
        print(f"[WARN] Erro geral ao buscar eventos Outlook para calendário: {e}")

    
    # Ordena por início
    events.sort(key=lambda e: e["start"])
    return events


# =============================================
# GET /api/meetings/room/{room_id}/schedule — Agenda de uma sala
# =============================================
@router.get("/room/{room_id}/schedule")
async def get_room_schedule(
    room_id: int,
    date: Optional[str] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna a agenda de uma sala para um dia específico.
    
    Combina reuniões do banco local + eventos do calendário Outlook da sala
    (se a sala tiver outlook_email configurado).
    
    Cada item retornado tem campo 'source': 'local' ou 'outlook'.
    """
    from datetime import date as date_type, timedelta
    
    # Parse da data
    if date:
        try:
            date_str = date.split('T')[0]
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.now().date()
    else:
        target_date = datetime.now().date()
    
    # Início e fim do dia
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = datetime.combine(target_date, datetime.max.time())
    
    # === 1. Reuniões LOCAIS (do banco) ===
    # selectinload(Reuniao.organizador) carrega o organizador em 1 query só,
    # em vez de fazer uma query separada por reunião (problema N+1)
    result = await db.execute(
        select(Reuniao).options(
            selectinload(Reuniao.sala),
            selectinload(Reuniao.participantes),
            selectinload(Reuniao.organizador)   # ← carrega junto, evita N+1
        ).where(
            and_(
                Reuniao.sala_id == room_id,
                Reuniao.status == 'agendada',
                Reuniao.data_hora_inicio <= day_end,
                Reuniao.data_hora_fim >= day_start
            )
        ).order_by(Reuniao.data_hora_inicio)
    )
    reunioes = result.scalars().all()
    
    meetings = []
    local_times = set()  # Para deduplicar com Outlook
    
    for r in reunioes:
        # Organizador já carregado — sem query extra ao banco
        org = r.organizador
        
        start_iso = r.data_hora_inicio.isoformat()
        end_iso = r.data_hora_fim.isoformat()
        local_times.add((start_iso[:16], end_iso[:16]))  # Chave para deduplicação
        
        meetings.append({
            "id": r.id,
            "title": r.titulo,
            "start": start_iso,
            "end": end_iso,
            "start_time": r.data_hora_inicio.strftime("%H:%M"),
            "end_time": r.data_hora_fim.strftime("%H:%M"),
            "organizer_name": org.nome if org else "Desconhecido",
            "organizer_email": org.email if org else "",
            "attendees_count": len(r.participantes),
            "teams_link": r.teams_link,
            "status": r.status,
            "source": "local"
        })
    
    # === 2. Eventos do OUTLOOK (se a sala tem outlook_email) ===
    sala_result = await db.execute(
        select(Sala).where(Sala.id == room_id)
    )
    sala = sala_result.scalar_one_or_none()
    
    if sala and sala.outlook_email:
        try:
            outlook_events = await graph_service.get_room_calendar_events(
                sala.outlook_email, day_start, day_end
            )
            
            for event in outlook_events:
                evt_start = event.get("start", {}).get("dateTime", "")
                evt_end = event.get("end", {}).get("dateTime", "")
                
                # Deduplicação: pula se já existe reunião local no mesmo horário
                if (evt_start[:16], evt_end[:16]) in local_times:
                    continue
                
                # Parse das datas do Outlook
                try:
                    start_dt = datetime.fromisoformat(evt_start)
                    end_dt = datetime.fromisoformat(evt_end)
                except (ValueError, TypeError):
                    continue
                
                organizer_info = event.get("organizer", {}).get("emailAddress", {})
                
                meetings.append({
                    "id": None,
                    "title": event.get("subject", "Reunião Outlook"),
                    "start": start_dt.isoformat(),
                    "end": end_dt.isoformat(),
                    "start_time": start_dt.strftime("%H:%M"),
                    "end_time": end_dt.strftime("%H:%M"),
                    "organizer_name": organizer_info.get("name", ""),
                    "organizer_email": organizer_info.get("address", ""),
                    "attendees_count": 0,
                    "teams_link": None,
                    "status": "agendada",
                    "source": "outlook"
                })
        except Exception as e:
            print(f"[WARN] Erro ao buscar eventos Outlook para sala {sala.nome}: {e}")
    
    # Ordena por horário de início
    meetings.sort(key=lambda m: m["start"])
    
    return {
        "room_id": room_id,
        "date": target_date.isoformat(),
        "meetings": meetings
    }


# =============================================
# POST /api/meetings/ — Criar nova reunião
# =============================================
# Função auxiliar: busca salas disponíveis (banco + Outlook)
# =============================================
async def _find_available_rooms(
    db: AsyncSession,
    start_dt: datetime,
    end_dt: datetime,
    exclude_room_id: int
) -> list:
    """
    Busca salas disponíveis no horário indicado.
    Verifica conflitos tanto no banco local quanto no Outlook da sala.
    """
    all_rooms_result = await db.execute(
        select(Sala).options(selectinload(Sala.recursos)).where(Sala.ativa == True)
    )
    all_rooms = all_rooms_result.scalars().all()
    
    available_rooms = []
    for r in all_rooms:
        if r.id == exclude_room_id:
            continue
        
        # 1. Verificar conflito no banco local
        room_conflict = await db.execute(
            select(Reuniao).where(
                Reuniao.sala_id == r.id,
                Reuniao.status == 'agendada',
                Reuniao.data_hora_inicio < end_dt,
                Reuniao.data_hora_fim > start_dt
            )
        )
        if room_conflict.scalar_one_or_none() is not None:
            continue
        
        # 2. Verificar conflito no Outlook da sala (se configurado)
        has_outlook_conflict = False
        if r.outlook_email:
            try:
                # Expande a janela em 3h para garantir captura de eventos deslocados
                query_start = start_dt - timedelta(hours=3)
                query_end = end_dt + timedelta(hours=3)
                room_events = await graph_service.get_room_calendar_events(
                    r.outlook_email, query_start, query_end
                )
                for evt in room_events:
                    evt_s = evt.get("start", {}).get("dateTime", "")
                    evt_e = evt.get("end", {}).get("dateTime", "")
                    # Converte para BRT naive (trata "Z", offsets e naive corretamente)
                    es = _to_brasilia_naive(evt_s)
                    ee = _to_brasilia_naive(evt_e)
                    if es is None or ee is None:
                        continue
                    # Normaliza start_dt/end_dt para naive (evita TypeError de fuso horário)
                    start_naive = start_dt.replace(tzinfo=None)
                    end_naive = end_dt.replace(tzinfo=None)
                    if es < end_naive and ee > start_naive:
                        has_outlook_conflict = True
                        break
            except Exception as e:
                print(f"[WARN] Erro ao verificar Outlook de {r.nome}: {e}")
        
        if not has_outlook_conflict:
            available_rooms.append({
                "id": r.id,
                "name": r.nome,
                "capacity": r.capacidade,
                "color": r.cor,
                "resources": [rec.nome_recurso for rec in r.recursos]
            })
    
    return available_rooms


# =============================================
# Função auxiliar: gera datas de recorrência
# =============================================
def generate_recurrence_dates(
    start_date: datetime,
    frequency: str,
    days: list,
    end_date_str: str
) -> list:
    """
    Gera lista de datas para reuniões recorrentes.
    
    Args:
        start_date: Data/hora de início da primeira reunião
        frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
        days: Lista de dias da semana (0=seg, 1=ter, ..., 4=sex)
        end_date_str: Data final no formato 'yyyy-MM-dd'
    
    Returns:
        Lista de datas (date objects) para criar reuniões
    """
    from datetime import date as date_type
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    dates = []
    current = start_date.date()
    
    if frequency == 'daily':
        # Todos os dias úteis (seg-sex) até end_date
        while current <= end_date:
            if current.weekday() < 5:  # 0=seg, 4=sex
                dates.append(current)
            current += timedelta(days=1)
    
    elif frequency == 'weekly':
        # Dias específicos da semana, toda semana
        while current <= end_date:
            if current.weekday() in days:
                dates.append(current)
            current += timedelta(days=1)
    
    elif frequency == 'biweekly':
        # Dias específicos da semana, a cada 2 semanas
        week_start = current - timedelta(days=current.weekday())  # Segunda da semana atual
        week_count = 0
        while current <= end_date:
            current_week_start = current - timedelta(days=current.weekday())
            if current_week_start != week_start:
                week_start = current_week_start
                week_count += 1
            if week_count % 2 == 0 and current.weekday() in days:
                dates.append(current)
            current += timedelta(days=1)
    
    elif frequency == 'monthly':
        # Mesmo dia do mês, todo mês
        from dateutil.relativedelta import relativedelta
        target_day = start_date.day
        month_current = current
        while month_current <= end_date:
            dates.append(month_current)
            try:
                month_current = (month_current.replace(day=1) + relativedelta(months=1)).replace(day=target_day)
            except ValueError:
                # Mês não tem esse dia (ex: 31), usa último dia do mês
                import calendar
                next_month = month_current.replace(day=1) + relativedelta(months=1)
                last_day = calendar.monthrange(next_month.year, next_month.month)[1]
                month_current = next_month.replace(day=min(target_day, last_day))
    
    # Remove a data original (já criada separadamente) se estiver na lista
    original_date = start_date.date()
    if original_date in dates:
        dates.remove(original_date)
    
    return dates


# =============================================
# POST /api/meetings/ — Criar nova reunião
# =============================================
@router.post("/", status_code=201)
async def create_meeting(
    meeting_data: MeetingCreate,
    background_tasks: BackgroundTasks,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cria uma nova reunião com verificação de conflitos.
    Suporta reuniões recorrentes (diária, semanal, quinzenal, mensal).
    
    Fluxo completo:
    1. Parse das datas de início e fim
    2. Busca a sala e verifica se existe
    3. Verifica conflitos de horário na sala
    4. Se conflito → retorna 409 com salas alternativas disponíveis
    5. Cria reunião no banco + participantes com tokens de confirmação
    6. Cria evento no calendário Outlook/Teams (se Azure configurado)
    7. Envia e-mails de convite para cada participante
    8. Se recorrente → repete passos 5-6 para cada data
    9. Retorna dados completos da reunião criada
    """
    # === PASSO 1: Parse das datas ===
    start_dt = datetime.fromisoformat(meeting_data.start_datetime)
    end_dt = datetime.fromisoformat(meeting_data.end_datetime)
    
    # === PASSO 2: Buscar sala ===
    result = await db.execute(
        select(Sala).options(selectinload(Sala.recursos)).where(Sala.id == meeting_data.room_id)
    )
    sala = result.scalar_one_or_none()
    
    if not sala:
        raise HTTPException(status_code=404, detail="Sala não encontrada")
    
    # === PASSO 3: Verificar conflitos de horário (primeira ocorrência) ===
    conflict_result = await db.execute(
        select(Reuniao).where(
            Reuniao.sala_id == meeting_data.room_id,
            Reuniao.status == 'agendada',
            Reuniao.data_hora_inicio < end_dt,
            Reuniao.data_hora_fim > start_dt
        )
    )
    conflict = conflict_result.scalar_one_or_none()
    
    # === PASSO 4: Conflito encontrado → retorna salas alternativas ===
    if conflict:
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
    
    # === PASSO 4b: Verificar conflitos no calendário Outlook da SALA ===
    if sala.outlook_email:
        try:
            # Expande a janela em 3h para garantir captura de eventos deslocados
            query_start = start_dt - timedelta(hours=3)
            query_end = end_dt + timedelta(hours=3)
            room_outlook_events = await graph_service.get_room_calendar_events(
                sala.outlook_email, query_start, query_end
            )
            for evt in room_outlook_events:
                evt_start_str = evt.get("start", {}).get("dateTime", "")
                evt_end_str = evt.get("end", {}).get("dateTime", "")
                # Converte para BRT naive (trata "Z", offsets e naive corretamente)
                evt_start = _to_brasilia_naive(evt_start_str)
                evt_end = _to_brasilia_naive(evt_end_str)
                if evt_start is None or evt_end is None:
                    continue
                # Normaliza start_dt/end_dt para naive (evita TypeError de fuso horário)
                start_naive = start_dt.replace(tzinfo=None)
                end_naive = end_dt.replace(tzinfo=None)
                # Verifica sobreposição
                if evt_start < end_naive and evt_end > start_naive:
                    # Buscar salas alternativas disponíveis
                    available_rooms = await _find_available_rooms(
                        db, start_dt, end_dt, meeting_data.room_id
                    )
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "message": f"Esta sala já está reservada por: {evt.get('organizer', {}).get('emailAddress', {}).get('name', 'Usuário Outlook')}",
                            "conflict": {
                                "title": evt.get("subject", "Reunião Outlook"),
                                "start": evt_start.isoformat(),
                                "end": evt_end.isoformat(),
                                "organizer": evt.get("organizer", {}).get("emailAddress", {}).get("name", ""),
                                "source": "outlook"
                            },
                            "available_rooms": available_rooms
                        }
                    )
        except HTTPException:
            raise
        except Exception as e:
            print(f"[WARN] Erro ao verificar Outlook da sala {sala.nome}: {e}")
    
    # === PREPARAR RECORRÊNCIA ===
    is_recurring = meeting_data.is_recurring
    grupo_id = str(uuid.uuid4()) if is_recurring else None
    padrao_json = None
    
    if is_recurring and meeting_data.recurrence_frequency and meeting_data.recurrence_end_date:
        padrao_json = json.dumps({
            "frequency": meeting_data.recurrence_frequency,
            "days": meeting_data.recurrence_days or [],
            "end_date": meeting_data.recurrence_end_date
        })
    
    # Calcula duração para aplicar em cada ocorrência
    duracao = end_dt - start_dt
    hora_inicio = start_dt.time()
    
    # Lista de todas as datas (primeira + recorrentes)
    all_dates = [start_dt.date()]
    if is_recurring and meeting_data.recurrence_frequency and meeting_data.recurrence_end_date:
        extra_dates = generate_recurrence_dates(
            start_dt,
            meeting_data.recurrence_frequency,
            meeting_data.recurrence_days or [],
            meeting_data.recurrence_end_date
        )
        all_dates.extend(extra_dates)
    
    print(f"\n{'='*60}")
    print(f"[INFO] Criando {len(all_dates)} reunião(ões) - Recorrente: {is_recurring}")
    if is_recurring:
        print(f"[INFO] Frequência: {meeting_data.recurrence_frequency}")
        print(f"[INFO] Dias: {meeting_data.recurrence_days}")
        print(f"[INFO] Até: {meeting_data.recurrence_end_date}")
    print(f"{'='*60}")
    
    # === CRIAR REUNIÕES (uma para cada data) ===
    primeira_reuniao = None
    reunioes_criadas = []
    conflitos_ignorados = 0
    
    for i, meeting_date in enumerate(all_dates):
        # Calcula início/fim para esta data específica
        occ_start = datetime.combine(meeting_date, hora_inicio)
        occ_end = occ_start + duracao
        
        # Verifica conflito na sala para esta data (pula datas com conflito)
        if i > 0:  # Primeira já foi verificada acima
            conf_result = await db.execute(
                select(Reuniao).where(
                    Reuniao.sala_id == meeting_data.room_id,
                    Reuniao.status == 'agendada',
                    Reuniao.data_hora_inicio < occ_end,
                    Reuniao.data_hora_fim > occ_start
                )
            )
            if conf_result.scalar_one_or_none():
                conflitos_ignorados += 1
                print(f"[WARN] Conflito em {meeting_date} — pulando esta data")
                continue
        
        # === PASSO 5: Criar reuniao no banco ===
        reuniao = Reuniao(
            titulo=meeting_data.title,
            descricao=meeting_data.description,
            sala_id=meeting_data.room_id,
            organizador_id=current_user.id,
            data_hora_inicio=occ_start,
            data_hora_fim=occ_end,
            status='agendada',
            recorrente=is_recurring,
            padrao_recorrencia=padrao_json,
            grupo_recorrencia=grupo_id
        )
        db.add(reuniao)
        await db.flush()
        
        # Cria participantes com tokens únicos
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
        
        # === PASSO 6: Criar evento no Teams/Outlook ===
        teams_link = None
        try:
            # Inclui o e-mail do organizador na lista de participantes do evento.
            # Isso faz com que o evento apareça no calendário pessoal do organizador
            # no Outlook/Teams — sem isso, o evento fica só na conta de serviço.
            organizer_email = current_user.email
            attendee_emails = [organizer_email] + [
                att.email for att in meeting_data.attendees
                if att.email != organizer_email   # evita duplicidade se o organizador se convidar
            ]
            # Inclui a sala como participante para aparecer no calendário da Microsoft
            if sala.outlook_email and sala.outlook_email not in attendee_emails:
                attendee_emails.append(sala.outlook_email)

            teams_result = await graph_service.create_calendar_event(
                subject=meeting_data.title,
                start=occ_start,
                end=occ_end,
                attendees=attendee_emails,
                description=meeting_data.description,
                room_name=sala.nome
            )
            if teams_result:
                teams_link = teams_result["join_url"]
                reuniao.teams_link = teams_link
                reuniao.teams_event_id = teams_result["event_id"]
                await db.commit()
                await db.refresh(reuniao)
        except Exception as e:
            print(f"[WARN] Erro ao criar evento Teams para {meeting_date}: {e}")
        
        # === PASSO 7: Enviar e-mails de convite (apenas para primeira ocorrência) ===
        if i == 0:
            for att_info in tokens_participantes:
                try:
                    result = await email_service.send_meeting_invitation(
                        to_email=att_info["email"],
                        participant_name=att_info["name"],
                        meeting_title=meeting_data.title,
                        meeting_id=reuniao.id,
                        meeting_date=occ_start,
                        meeting_start=occ_start.strftime("%H:%M"),
                        meeting_end=occ_end.strftime("%H:%M"),
                        room_name=sala.nome,
                        organizer_name=current_user.nome,
                        organizer_email=current_user.email,
                        confirmation_token=att_info["token"],
                        description=meeting_data.description,
                        teams_link=teams_link
                    )
                    if not result:
                        print(f"[WARN] E-mail nao enviado para {att_info['email']}")
                except Exception as e:
                    print(f"[ERROR] Erro ao enviar e-mail para {att_info['email']}: {e}")
        
        if i == 0:
            primeira_reuniao = reuniao
        
        reunioes_criadas.append(reuniao.id)
        print(f"[OK] Reunião #{reuniao.id} criada para {meeting_date}")
    
    if conflitos_ignorados > 0:
        print(f"[WARN] {conflitos_ignorados} data(s) com conflito foram ignoradas")
    
    print(f"[OK] Total: {len(reunioes_criadas)} reunião(ões) criada(s)")
    
    # === PASSO 8: Retorna dados da reunião criada ===
    return {
        "id": primeira_reuniao.id,
        "title": primeira_reuniao.titulo,
        "description": primeira_reuniao.descricao,
        "room_id": primeira_reuniao.sala_id,
        "room_name": sala.nome,
        "room_color": sala.cor,
        "organizer_id": primeira_reuniao.organizador_id,
        "organizer_email": current_user.email,
        "organizer_name": current_user.nome,
        "attendees": [{"email": a.email, "name": a.name, "status": "pending"} for a in meeting_data.attendees],
        "start_datetime": primeira_reuniao.data_hora_inicio.isoformat(),
        "end_datetime": primeira_reuniao.data_hora_fim.isoformat(),
        "is_recurring": is_recurring,
        "recurrence_pattern": padrao_json,
        "recurrence_group": grupo_id,
        "total_occurrences": len(reunioes_criadas),
        "skipped_conflicts": conflitos_ignorados,
        "status": primeira_reuniao.status,
        "teams_link": primeira_reuniao.teams_link,
        "created_at": primeira_reuniao.criado_em.isoformat()
    }


# =============================================
# GET /api/meetings/check-availability — Verificar disponibilidade
# =============================================
@router.get("/check-availability")
async def check_availability(
    room_id: int,
    start: str,
    end: str,
    meeting_id: Optional[int] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verifica se o horário está disponível na sala informada.
    
    Usado pelo frontend em tempo real enquanto o usuário seleciona
    data/hora, mostrando se há conflito antes de tentar criar.
    
    Se houver conflito, retorna a lista de salas disponíveis como alternativa.
    
    Args:
        room_id: ID da sala a verificar
        start: Data/hora de início (ISO 8601)
        end: Data/hora de fim (ISO 8601)
        meeting_id: ID da reunião atual (excluída da verificação ao editar)
    """
    start_dt = datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end)
    
    # Verifica se existe reunião no mesmo horário e sala
    query = select(Reuniao).where(
        Reuniao.sala_id == room_id,
        Reuniao.status == 'agendada',
        Reuniao.data_hora_inicio < end_dt,
        Reuniao.data_hora_fim > start_dt
    )
    
    # Se estiver editando, exclui a própria reunião da verificação local
    if meeting_id:
        query = query.where(Reuniao.id != meeting_id)
    
    # Executa a busca no banco local
    result = await db.execute(query)
    conflict = result.scalar_one_or_none()
    
    # Se estiver editando, busca o teams_event_id para ignorar no Outlook também
    current_teams_event_id = None
    if meeting_id:
        current_meeting = await db.get(Reuniao, meeting_id)
        if current_meeting:
            current_teams_event_id = current_meeting.teams_event_id
    
    # Se nao ha conflito no banco local, verifica no Outlook/Teams da SALA
    outlook_conflict = None
    if conflict is None:
        sala_result_chk = await db.execute(select(Sala).where(Sala.id == room_id))
        sala_chk = sala_result_chk.scalar_one_or_none()
        if sala_chk and sala_chk.outlook_email:
            try:
                # Expande a janela em 3h para garantir captura de eventos deslocados
                query_start = start_dt - timedelta(hours=3)
                query_end = end_dt + timedelta(hours=3)
                room_outlook_events = await graph_service.get_room_calendar_events(
                    sala_chk.outlook_email, query_start, query_end
                )
                for evt in room_outlook_events:
                    # Ignora se for o próprio evento da reunião que estamos editando
                    if current_teams_event_id and evt.get("id") == current_teams_event_id:
                        continue
                        
                    evt_s = evt.get("start", {}).get("dateTime", "")
                    evt_e = evt.get("end", {}).get("dateTime", "")
                    # Converte para BRT naive (trata "Z", offsets e naive corretamente)
                    es = _to_brasilia_naive(evt_s)
                    ee = _to_brasilia_naive(evt_e)
                    if es is None or ee is None:
                        continue
                    # Normaliza start_dt/end_dt para naive também (evita TypeError de fuso horário)
                    start_naive = start_dt.replace(tzinfo=None)
                    end_naive = end_dt.replace(tzinfo=None)
                    if es < end_naive and ee > start_naive:
                        outlook_conflict = {
                            "title": evt.get("subject", "Reunião Outlook"),
                            "start": es.isoformat(),
                            "end": ee.isoformat(),
                            "organizer": evt.get("organizer", {}).get("emailAddress", {}).get("name", "")
                        }
                        break
            except Exception as e:
                print(f"[WARN] Erro ao verificar Outlook da sala: {e}")
    
    has_any_conflict = conflict is not None or outlook_conflict is not None
    
    response = {
        "is_available": not has_any_conflict,
        "room_id": room_id,
        "start": start,
        "end": end
    }
    
    # Se há conflito, retorna detalhes + salas alternativas
    if conflict:
        sala_result = await db.execute(select(Sala).where(Sala.id == room_id))
        sala = sala_result.scalar_one_or_none()
        
        # Busca salas sem conflito no mesmo horário
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
    
    # Se nao ha conflito no banco mas ha no Outlook
    if not conflict and outlook_conflict:
        # Buscar salas alternativas disponíveis (banco + Outlook)
        available_rooms = await _find_available_rooms(db, start_dt, end_dt, room_id)
        
        response["conflict"] = {
            "message": f"Está sala já está reservada por: '{outlook_conflict['organizer']}'",
            "meeting": {
                "title": outlook_conflict["title"],
                "start": outlook_conflict["start"],
                "end": outlook_conflict["end"],
                "organizer": outlook_conflict.get("organizer", ""),
                "source": "outlook"
            }
        }
        response["available_rooms"] = available_rooms
    
    return response


# =============================================
# PUT /api/meetings/{id} — Editar reunião
# =============================================
@router.put("/{meeting_id}")
async def update_meeting(
    meeting_id: int,
    update_data: MeetingUpdate,
    background_tasks: BackgroundTasks,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza uma reunião existente (apenas o organizador pode editar).
    
    Fluxo:
    1. Busca a reunião e valida permissão (organizador)
    2. Verifica conflitos de sala excluindo a própria reunião
    3. Atualiza campos no banco de dados
    4. Atualiza participantes (remove antigos, cria novos)
    5. Atualiza evento no Outlook/Teams se existir
    6. Envia convites para novos participantes
    """
    # === 1. Busca reunião e valida permissão ===
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
    
    if reuniao.organizador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o organizador pode editar esta reunião")
    
    if reuniao.status != 'agendada':
        raise HTTPException(status_code=400, detail="Apenas reuniões agendadas podem ser editadas")
    
    # === 2. Determina novos valores (usa existente se não informado) ===
    new_title = update_data.title or reuniao.titulo
    new_description = update_data.description if update_data.description is not None else reuniao.descricao
    new_room_id = update_data.room_id or reuniao.sala_id
    new_start = datetime.fromisoformat(update_data.start_datetime) if update_data.start_datetime else reuniao.data_hora_inicio
    new_end = datetime.fromisoformat(update_data.end_datetime) if update_data.end_datetime else reuniao.data_hora_fim
    
    # === 3. Verifica conflito de sala (excluindo a própria reunião) ===
    conflict_query = select(Reuniao).where(
        Reuniao.sala_id == new_room_id,
        Reuniao.status == 'agendada',
        Reuniao.data_hora_inicio < new_end,
        Reuniao.data_hora_fim > new_start,
        Reuniao.id != meeting_id  # ← Exclui a própria reunião!
    )
    conflict_result = await db.execute(conflict_query)
    conflict = conflict_result.scalar_one_or_none()
    
    if conflict:
        # Busca nome da sala para mensagem
        sala_result = await db.execute(select(Sala).where(Sala.id == new_room_id))
        sala = sala_result.scalar_one_or_none()
        
        # Busca salas alternativas
        available_rooms = await _find_available_rooms(db, new_start, new_end, new_room_id)
        
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"A sala '{sala.nome if sala else 'selecionada'}' já está reservada neste horário.",
                "conflict": {
                    "title": conflict.titulo,
                    "start": conflict.data_hora_inicio.isoformat(),
                    "end": conflict.data_hora_fim.isoformat()
                },
                "available_rooms": available_rooms
            }
        )
    
    # === 3b. Verifica conflito no Outlook da sala ===
    new_sala_result = await db.execute(
        select(Sala).options(selectinload(Sala.recursos)).where(Sala.id == new_room_id)
    )
    new_sala = new_sala_result.scalar_one_or_none()
    
    if new_sala and new_sala.outlook_email:
        try:
            query_start = new_start - timedelta(hours=3)
            query_end = new_end + timedelta(hours=3)
            room_outlook_events = await graph_service.get_room_calendar_events(
                new_sala.outlook_email, query_start, query_end
            )
            for evt in room_outlook_events:
                evt_start_str = evt.get("start", {}).get("dateTime", "")
                evt_end_str = evt.get("end", {}).get("dateTime", "")
                es = _to_brasilia_naive(evt_start_str)
                ee = _to_brasilia_naive(evt_end_str)
                if es is None or ee is None:
                    continue
                start_naive = new_start.replace(tzinfo=None)
                end_naive = new_end.replace(tzinfo=None)
                # Ignora conflito com o próprio evento (mesmo teams_event_id)
                evt_id = evt.get("id", "")
                if reuniao.teams_event_id and evt_id == reuniao.teams_event_id:
                    continue
                if es < end_naive and ee > start_naive:
                    available_rooms = await _find_available_rooms(db, new_start, new_end, new_room_id)
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "message": f"Esta sala já está reservada por: '{evt.get('organizer', {}).get('emailAddress', {}).get('name', 'Usuário Outlook')}'",
                            "conflict": {
                                "title": evt.get("subject", "Reunião Outlook"),
                                "start": es.isoformat(),
                                "end": ee.isoformat(),
                                "source": "outlook"
                            },
                            "available_rooms": available_rooms
                        }
                    )
        except HTTPException:
            raise
        except Exception as e:
            print(f"[WARN] Erro ao verificar Outlook da sala na edição: {e}")
    
    # === 4. Atualiza campos no banco ===
    reuniao.titulo = new_title
    reuniao.descricao = new_description
    reuniao.sala_id = new_room_id
    reuniao.data_hora_inicio = new_start
    reuniao.data_hora_fim = new_end
    
    # === 5. Atualiza participantes ===
    emails_antigos = {p.email for p in reuniao.participantes}
    novos_participantes_info = []
    
    if update_data.attendees is not None:
        emails_novos = {a.email for a in update_data.attendees}
        
        # Remove participantes que saíram
        for p in list(reuniao.participantes):
            if p.email not in emails_novos:
                await db.delete(p)
        
        # Adiciona participantes novos
        for att in update_data.attendees:
            if att.email not in emails_antigos:
                confirmation_token = secrets.token_urlsafe(32)
                participante = ParticipanteReuniao(
                    reuniao_id=reuniao.id,
                    email=att.email,
                    nome=att.name,
                    status='pendente',
                    confirmation_token=confirmation_token
                )
                db.add(participante)
                novos_participantes_info.append({
                    "email": att.email,
                    "name": att.name,
                    "token": confirmation_token
                })
    
    await db.commit()
    await db.refresh(reuniao)
    
    # === 6. Atualiza evento no Outlook/Teams ===
    if reuniao.teams_event_id:
        try:
            # Monta lista de participantes atualizada
            attendee_emails = [current_user.email]
            if update_data.attendees is not None:
                attendee_emails += [
                    att.email for att in update_data.attendees
                    if att.email != current_user.email
                ]
            if new_sala and new_sala.outlook_email and new_sala.outlook_email not in attendee_emails:
                attendee_emails.append(new_sala.outlook_email)
            
            await graph_service.update_calendar_event(
                event_id=reuniao.teams_event_id,
                subject=new_title,
                start=new_start,
                end=new_end,
                attendees=attendee_emails,
                description=new_description,
                room_name=new_sala.nome if new_sala else None
            )
        except Exception as e:
            print(f"[WARN] Erro ao atualizar evento no Teams: {e}")
    
    # === 7. Envia convites para NOVOS participantes ===
    sala_nome = new_sala.nome if new_sala else (reuniao.sala.nome if reuniao.sala else "Sala")
    for att_info in novos_participantes_info:
        try:
            await email_service.send_meeting_invitation(
                to_email=att_info["email"],
                participant_name=att_info["name"],
                meeting_title=new_title,
                meeting_id=reuniao.id,
                meeting_date=new_start,
                meeting_start=new_start.strftime("%H:%M"),
                meeting_end=new_end.strftime("%H:%M"),
                room_name=sala_nome,
                organizer_name=current_user.nome,
                organizer_email=current_user.email,
                confirmation_token=att_info["token"],
                description=new_description,
                teams_link=reuniao.teams_link
            )
        except Exception as e:
            print(f"[WARN] Erro ao enviar convite para {att_info['email']}: {e}")
    
    print(f"[OK] Reunião #{meeting_id} atualizada por {current_user.email}")
    
    # === 8. Retorna dados atualizados ===
    # Recarrega participantes atualizados
    await db.refresh(reuniao, ['participantes'])
    
    return {
        "id": reuniao.id,
        "title": reuniao.titulo,
        "description": reuniao.descricao,
        "room_id": reuniao.sala_id,
        "room_name": sala_nome,
        "room_color": new_sala.cor if new_sala else None,
        "organizer_id": reuniao.organizador_id,
        "organizer_email": current_user.email,
        "organizer_name": current_user.nome,
        "attendees": [
            {"email": p.email, "name": p.nome, "status": p.status}
            for p in reuniao.participantes
        ],
        "start_datetime": reuniao.data_hora_inicio.isoformat(),
        "end_datetime": reuniao.data_hora_fim.isoformat(),
        "status": reuniao.status,
        "teams_link": reuniao.teams_link,
        "created_at": reuniao.criado_em.isoformat()
    }


# =============================================
# GET /api/meetings/{id} — Detalhes de uma reunião
# =============================================
@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna os detalhes completos de uma reunião específica.
    
    Carrega sala, organizador e participantes em uma única query (eager loading).
    Acessível por qualquer usuário autenticado.
    """
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
        "teams_link": reuniao.teams_link,
        "created_at": reuniao.criado_em.isoformat()
    }


# =============================================
# DELETE /api/meetings/{id} — Cancelar reunião
# =============================================
@router.delete("/{meeting_id}")
async def cancel_meeting(
    meeting_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancela uma reunião (apenas o organizador pode cancelar).
    
    Fluxo:
    1. Busca a reunião pelo ID
    2. Verifica se o usuário logado é o organizador
    3. Se tem evento no Teams, cancela via Graph API
    4. Marca a reunião como 'cancelada' no banco
    """
    result = await db.execute(
        select(Reuniao).where(Reuniao.id == meeting_id)
    )
    reuniao = result.scalar_one_or_none()
    
    if not reuniao:
        raise HTTPException(status_code=404, detail="Reunião não encontrada")
    
    # Apenas o organizador pode cancelar
    if reuniao.organizador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o organizador pode cancelar")
    
    # Cancela o evento no Teams/Outlook se existir
    if reuniao.teams_event_id:
        try:
            await graph_service.cancel_calendar_event(reuniao.teams_event_id)
        except Exception as e:
            print(f"[WARN] Erro ao cancelar evento no Teams: {e}")
    
    # Marca como cancelada (soft delete — mantém o histórico)
    reuniao.status = 'cancelada'
    await db.commit()
    
    return {"message": "Reunião cancelada com sucesso"}


# =============================================================
#  ROTAS PÚBLICAS — Confirmação de presença via e-mail
# =============================================================

# =============================================
# POST /api/meeting-confirmation/respond — Aceitar/recusar convite
# =============================================
@public_router.post("/respond")
async def respond_to_meeting(
    token: str,
    response: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Registra a resposta do participante ao convite.
    Chamado pelo frontend na página de resposta do convite.
    
    O participante é identificado pelo token único gerado na criação da reunião.
    Após a resposta, o token é invalidado (uso único).
    
    Args:
        token: Token de confirmação único do participante
        response: "accept" ou "decline"
    """
    # Busca o participante pelo token de confirmação no banco
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
    
    # Atualiza o status do participante
    if response == "accept":
        participante.status = "aceito"
        status_text = "aceita"
    else:
        participante.status = "recusado"
        status_text = "recusada"
    
    # Invalida o token para prevenir reuso
    participante.confirmation_token = None
    
    await db.commit()
    
    return {
        "message": f"Sua resposta foi registrada com sucesso!",
        "meeting_title": meeting_title,
        "response": response,
        "status_text": status_text
    }


# =============================================
# GET /api/meeting-confirmation/respond-info — Informações do convite
# =============================================
@public_router.get("/respond-info")
async def get_meeting_response_info(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna informações do convite para exibir na página de resposta.
    
    O frontend usa esse endpoint para mostrar detalhes da reunião
    antes do participante decidir aceitar ou recusar.
    
    Args:
        token: Token de confirmação do participante
    """
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


# =============================================
# GET /api/meetings/confirm — Confirmação via link direto (HTML)
# =============================================
@router.get("/confirm", response_class=HTMLResponse)
async def confirm_meeting_attendance(
    token: str,
    response: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Confirmação de presença via link direto — retorna página HTML.
    
    Diferente de /respond (que retorna JSON para o frontend),
    este endpoint retorna HTML completo diretamente ao navegador.
    Útil para links em e-mails que abrem diretamente no navegador.
    
    Retorna páginas estilizadas para:
    - Token inválido (⚠️)
    - Participante não encontrado (❌)
    - Presença confirmada (✅)
    - Convite recusado (❌)
    """
    
    # Verifica se o token existe no armazenamento temporário
    token_data = meeting_confirmation_tokens.get(token)
    
    if not token_data:
        # Página de erro: token inválido ou expirado
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
    
    # Busca o participante no banco
    result = await db.execute(
        select(ParticipanteReuniao).where(
            ParticipanteReuniao.reuniao_id == meeting_id,
            ParticipanteReuniao.email == email
        )
    )
    participante = result.scalar_one_or_none()
    
    if not participante:
        # Página de erro: participante não encontrado
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
    
    # Atualiza o status do participante
    is_accepted = response == "accept"
    if is_accepted:
        participante.status = "aceito"
    else:
        participante.status = "recusado"
    
    await db.commit()
    
    # Remove token usado (uso único)
    del meeting_confirmation_tokens[token]
    
    # Retorna página HTML de confirmação
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
