"""Verificar tokens de confirmação no banco."""
import pymysql

conn = pymysql.connect(
    host='localhost',
    user='root',
    password='',
    database='sistema_agendamento'
)

try:
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT p.id, p.email, p.status, p.confirmation_token, r.titulo
            FROM participantes_reuniao p
            LEFT JOIN reunioes r ON p.reuniao_id = r.id
            ORDER BY p.id DESC
            LIMIT 10
        """)
        
        rows = cursor.fetchall()
        print("\n=== ÚLTIMOS PARTICIPANTES ===")
        print("ID | Email | Status | Token | Reunião")
        print("-" * 80)
        for row in rows:
            token_display = row[3][:20] + "..." if row[3] else "NULL"
            print(f"{row[0]} | {row[1]} | {row[2]} | {token_display} | {row[4]}")
        
except Exception as e:
    print(f"Erro: {e}")
finally:
    conn.close()
