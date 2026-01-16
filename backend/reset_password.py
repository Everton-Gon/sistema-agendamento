"""Resetar senha do usuário."""
import pymysql
import hashlib

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

conn = pymysql.connect(host='localhost', user='root', password='', database='sistema_agendamento')
cursor = conn.cursor()

# Nova senha: 123456
nova_senha = '123456'
novo_hash = hash_password(nova_senha)

cursor.execute("UPDATE usuarios SET senha_hash = %s WHERE email = 'egoncalves@mallory.com.br'", (novo_hash,))
conn.commit()

print(f"Senha resetada para: {nova_senha}")
print(f"Novo hash: {novo_hash}")
print(f"Linhas afetadas: {cursor.rowcount}")

conn.close()
