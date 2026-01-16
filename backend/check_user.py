"""Verificar usuário."""
import pymysql
conn = pymysql.connect(host='localhost', user='root', password='', database='sistema_agendamento')
cursor = conn.cursor()
cursor.execute("SELECT id, email, nome, senha_hash FROM usuarios WHERE email='egoncalves@mallory.com.br'")
r = cursor.fetchone()
if r:
    print(f"ID: {r[0]}")
    print(f"Email: {r[1]}")  
    print(f"Nome: {r[2]}")
    print(f"Hash: {r[3][:50]}...")
else:
    print("Usuario NAO encontrado")
conn.close()
