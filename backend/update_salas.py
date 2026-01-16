import pymysql

conn = pymysql.connect(
    host='localhost',
    user='root',
    password='',
    database='sistema_agendamento'
)

cur = conn.cursor()

# Limpar dados antigos
cur.execute('DELETE FROM recursos_sala')
cur.execute('DELETE FROM salas')

# Inserir novas salas
salas = [
    ('Sala 02', 4, '#3b82f6'),
    ('Sala 03', 6, '#8b5cf6'),
    ('Sala 04', 12, '#10b981'),
    ('Sala Conselho', 5, '#f59e0b'),
    ('Showroom', 20, '#ef4444'),
    ('ShowroomSP', 8, '#06b6d4'),
]

for nome, capacidade, cor in salas:
    cur.execute("INSERT INTO salas (nome, capacidade, cor) VALUES (%s, %s, %s)", (nome, capacidade, cor))

conn.commit()

# Inserir recursos
recursos = {
    'Sala 02': ['TV'],
    'Sala 03': ['TV'],
    'Sala 04': ['TV'],
    'Sala Conselho': ['TV', 'Webcam'],
    'Showroom': ['TV'],
    'ShowroomSP': ['TV'],
}

for sala_nome, recursos_lista in recursos.items():
    cur.execute("SELECT id FROM salas WHERE nome = %s", (sala_nome,))
    sala_id = cur.fetchone()[0]
    for recurso in recursos_lista:
        cur.execute("INSERT INTO recursos_sala (sala_id, nome_recurso) VALUES (%s, %s)", (sala_id, recurso))

conn.commit()
conn.close()

print("✅ Salas atualizadas com sucesso!")
print("   - Sala 02")
print("   - Sala 03")
print("   - Sala 04")
print("   - Sala Conselho")
print("   - Showroom")
print("   - ShowroomSP")
