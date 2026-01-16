"""Pegar token completo."""
import pymysql
conn = pymysql.connect(host='localhost', user='root', password='', database='sistema_agendamento')
cursor = conn.cursor()
cursor.execute("SELECT id, email, confirmation_token FROM participantes_reuniao WHERE confirmation_token IS NOT NULL ORDER BY id DESC LIMIT 1")
row = cursor.fetchone()
if row:
    print(f"ID: {row[0]}")
    print(f"Email: {row[1]}")
    print(f"Token completo: {row[2]}")
else:
    print("Nenhum token encontrado")
conn.close()
