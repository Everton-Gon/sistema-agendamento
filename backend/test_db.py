"""Teste de criação de participante com token."""
import asyncio
import secrets
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

DATABASE_URL = "mysql+aiomysql://root:@localhost/sistema_agendamento"

async def test():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Verificar estrutura da tabela
        result = await session.execute(text("""
            DESCRIBE participantes_reuniao
        """))
        print("\n=== ESTRUTURA DA TABELA ===")
        for row in result:
            print(row)
        
        # Verificar últimos registros
        result = await session.execute(text("""
            SELECT id, email, status, confirmation_token 
            FROM participantes_reuniao 
            ORDER BY id DESC LIMIT 5
        """))
        print("\n=== ÚLTIMOS REGISTROS ===")
        for row in result:
            print(row)
    
    await engine.dispose()

asyncio.run(test())
