"""Verificar reuniões recentes."""
import pymysql
conn = pymysql.connect(host='localhost', user='root', password='', database='sistema_agendamento')
cursor = conn.cursor()
cursor.execute("""
    SELECT r.id, r.titulo, r.criado_em, 
           (SELECT confirmation_token FROM participantes_reuniao WHERE reuniao_id = r.id LIMIT 1) as token
    FROM reunioes r
    ORDER BY r.id DESC LIMIT 5
""")
print("Últimas reuniões:")
for row in cursor.fetchall():
    token = row[3][:30] + "..." if row[3] else "NULL"
    print(f"  ID:{row[0]} | {row[1]} | Criado:{row[2]} | Token:{token}")
conn.close()
