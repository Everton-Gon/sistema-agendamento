from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db, close_db
from app.routes import auth, rooms, meetings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    # Startup
    print("🚀 Starting Meeting Scheduler API...")
    await init_db()
    print("✅ API Ready!")
    
    yield
    
    # Shutdown
    await close_db()
    print("👋 Shutting down...")


app = FastAPI(
    title="Meeting Scheduler API",
    description="API para sistema de agendamento de reuniões",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", settings.frontend_url],
    # allow_origins=["*"], # Permite qualquer origem (para Dev Tunnels/Mobile)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(meetings.router)
app.include_router(meetings.public_router)  # Rotas públicas de confirmação


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Meeting Scheduler API", "status": "running"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "database": "mysql"}
