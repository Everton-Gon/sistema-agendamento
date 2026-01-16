"""Verificar reuniões e participantes mais recentes."""
import pymysql
conn = pymysql.connect(host='localhost', user='root', password='', database='sistema_agendamento')
cursor = conn.cursor()

# Últimas reuniões
cursor.execute("SELECT id, titulo, criado_em FROM reunioes ORDER BY id DESC LIMIT 5")
print("Últimas reuniões:")
for r in cursor.fetchall():
    print(f"  ID:{r[0]} | {r[1]} | Criado:{r[2]}")

# Últimos participantes
cursor.execute("SELECT id, reuniao_id, email, status, confirmation_token, criado_em FROM participantes_reuniao ORDER BY id DESC LIMIT 5")
print("\nÚltimos participantes:")
for r in cursor.fetchall():
    token = r[4] if r[4] else "NULL"
    print(f"  ID:{r[0]} Reuniao:{r[1]} | {r[2][:25]} | Status:{r[3]} | Criado:{r[5]} | Token:{token}")

conn.close()
