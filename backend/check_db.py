"""Verificar tokens."""
import pymysql

conn = pymysql.connect(host='localhost', user='root', password='', database='sistema_agendamento')
cursor = conn.cursor()

# Verificar estrutura
cursor.execute("DESCRIBE participantes_reuniao")
print("=== COLUNAS ===")
for row in cursor.fetchall():
    print(f"  {row[0]} - {row[1]}")

# Últimos participantes
cursor.execute("SELECT id, email, status, confirmation_token FROM participantes_reuniao ORDER BY id DESC LIMIT 5")
print("\n=== ÚLTIMOS PARTICIPANTES ===")
for row in cursor.fetchall():
    print(f"  ID:{row[0]} Email:{row[1]} Status:{row[2]} Token:{row[3]}")

conn.close()
