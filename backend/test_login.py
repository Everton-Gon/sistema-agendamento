"""Testar login."""
import pymysql
import hashlib

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

conn = pymysql.connect(host='localhost', user='root', password='', database='sistema_agendamento')
cursor = conn.cursor()

# Buscar usuário
cursor.execute("SELECT id, email, nome, senha_hash FROM usuarios WHERE email='egoncalves@mallory.com.br'")
r = cursor.fetchone()

if r:
    print(f"Usuário encontrado: ID={r[0]}, Nome={r[2]}")
    print(f"Hash no banco: {r[3]}")
    
    # Testar algumas senhas comuns
    senhas_teste = ['123456', 'password', 'admin', 'teste', 'Yaj12981@', '12345678']
    for senha in senhas_teste:
        hash_teste = hash_password(senha)
        if hash_teste == r[3]:
            print(f"SENHA ENCONTRADA: {senha}")
            break
    else:
        print("Nenhuma senha comum correspondeu")
        print(f"Hash de '123456': {hash_password('123456')}")
else:
    print("Usuário não encontrado")

conn.close()
