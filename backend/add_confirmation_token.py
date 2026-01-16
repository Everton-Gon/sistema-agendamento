"""Script para adicionar coluna confirmation_token na tabela participantes_reuniao."""
import pymysql

# Configurações do banco
conn = pymysql.connect(
    host='localhost',
    user='root',
    password='',
    database='sistema_agendamento'
)

try:
    with conn.cursor() as cursor:
        # Verificar se a coluna já existe
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'sistema_agendamento' 
            AND TABLE_NAME = 'participantes_reuniao' 
            AND COLUMN_NAME = 'confirmation_token'
        """)
        
        if cursor.fetchone() is None:
            # Adicionar coluna
            cursor.execute("""
                ALTER TABLE participantes_reuniao 
                ADD COLUMN confirmation_token VARCHAR(64) NULL
            """)
            print("✅ Coluna 'confirmation_token' adicionada com sucesso!")
        else:
            print("ℹ️ Coluna 'confirmation_token' já existe.")
        
        conn.commit()
        
except Exception as e:
    print(f"❌ Erro: {e}")
finally:
    conn.close()
