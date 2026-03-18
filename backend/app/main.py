"""
=============================================================
  main.py — Ponto de entrada da API FastAPI
=============================================================
  Responsável por:
  - Criar a instância do FastAPI  
  - Configurar o CORS (Cross-Origin Resource Sharing)
  - Registrar as rotas (auth, rooms, meetings)
  - Gerenciar o ciclo de vida (startup/shutdown) da aplicação
=============================================================
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from app.config import get_settings
from app.database import init_db, close_db, get_db, Reuniao
from app.routes import auth, rooms, meetings
from app.services.graph_service import graph_service
from sqlalchemy import select
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Carrega as configurações do .env
settings = get_settings()

# Scheduler para jobs em background (polling de cancelamentos)
scheduler = AsyncIOScheduler()


async def sync_cancelled_outlook_meetings():
    """
    Job de polling — roda a cada 1 minuto.

    Verifica se alguma reunião ativa foi cancelada diretamente no Outlook/Teams
    sem passar pelo sistema. Se sim, atualiza o status no banco para 'cancelada'.

    Fluxo:
    1. Busca todas as reuniões com status='agendada' e teams_event_id preenchido
    2. Para cada uma, pergunta ao Graph API: "esse evento ainda existe?"
    3. Se não existir (404) ou isCancelled=True → marca como 'cancelada' no banco
    """
    try:
        # Cria uma sessão de banco fora do contexto de requisição HTTP
        async for db in get_db():
            result = await db.execute(
                select(Reuniao).where(
                    Reuniao.status == 'agendada',
                    Reuniao.teams_event_id != None
                )
            )
            reunioes = result.scalars().all()

            if not reunioes:
                return  # Nada a verificar

            canceladas = 0
            for reuniao in reunioes:
                event_exists = await graph_service.check_event_exists(reuniao.teams_event_id)
                if not event_exists:
                    reuniao.status = 'cancelada'
                    canceladas += 1

            if canceladas > 0:
                await db.commit()
                print(f"[SYNC] {canceladas} reunião(ões) cancelada(s) no Outlook foram sincronizadas.")

    except Exception as e:
        print(f"[WARN] Erro no job de sincronização de cancelamentos: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação.

    - Startup: Inicializa o banco de dados MySQL, cria salas padrão
               e inicia o scheduler de sincronização com Outlook.
    - Shutdown: Para o scheduler e fecha a conexão com o banco de dados.
    """
    # === STARTUP ===
    print("[*] Starting Meeting Scheduler API...")
    await init_db()      # Conecta ao MySQL e cria salas padrão se necessário

    # Inicia o job de polling: verifica cancelamentos no Outlook a cada 1 minuto
    scheduler.add_job(
        sync_cancelled_outlook_meetings,
        "interval",
        minutes=1,
        id="outlook_sync",
        max_instances=1,        # Garante que só roda uma instância por vez
        misfire_grace_time=30   # Se atrasar até 30s, ainda executa
    )
    scheduler.start()
    print("[OK] Outlook sync scheduler started (every 1 minute)")
    print("[OK] API Ready!")

    yield  # Aplicação rodando aqui

    # === SHUTDOWN ===
    scheduler.shutdown(wait=False)
    await close_db()     # Fecha pool de conexões MySQL
    print("[*] Shutting down...")


# =============================================
# Cria a instância principal do FastAPI
# =============================================
app = FastAPI(
    title="Meeting Scheduler API",
    description="API para sistema de agendamento de reuniões",
    version="1.0.0",
    lifespan=lifespan
)


# =============================================
# Configuração do CORS
# =============================================
# Permite que o frontend (React) faça requisições para o backend.
# Sem isso, o navegador bloqueia as chamadas por política de segurança.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://malloryapp.com.br",     # Frontend em produção
        "http://localhost:5173",          # Vite dev server (desenvolvimento local)
        "http://localhost:3000",          # Alternativa (React CRA)
        settings.frontend_url             # URL configurável via .env
    ],
    allow_credentials=True,          # Permite envio de cookies/tokens
    allow_methods=["*"],             # Permite todos os métodos HTTP (GET, POST, etc.)
    allow_headers=["*"],             # Permite todos os headers (Authorization, etc.)
)


# =============================================
# Middleware COOP — necessário para login Microsoft (popup)
# =============================================
# Sem esse header, o MSAL não consegue monitorar o popup do Azure AD
# e o login fica bloqueado com erro de Cross-Origin-Opener-Policy.
@app.middleware("http")
async def add_coop_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    return response


# =============================================
# Registro das rotas da API
# =============================================
app.include_router(auth.router)               # /api/auth/* (login, registro, senha)
app.include_router(rooms.router)              # /api/rooms/* (listagem de salas)
app.include_router(meetings.router)           # /api/meetings/* (CRUD de reuniões)
app.include_router(meetings.public_router)    # /meetings/confirm/* (links públicos de confirmação)


# =============================================
# Endpoints de status
# =============================================
@app.get("/")
async def root():
    """
    Endpoint raiz — retorna status básico da API.
    Útil para verificar se o servidor está respondendo.
    """
    return {"message": "Meeting Scheduler API", "status": "running"}


@app.get("/health")
async def health_check():
    """
    Health check — verifica se a API está saudável.
    Usado por ferramentas de monitoramento e load balancers.
    """
    return {"status": "healthy", "database": "mysql"}
