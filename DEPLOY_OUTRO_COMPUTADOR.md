# 🚀 Guia de Deploy em Outro Computador

## Pré-requisitos
- Python 3.10+ instalado
- Node.js 18+ instalado
- MySQL 8.0+ rodando e acessível

---

## 📋 Passos para Configurar

### 1️⃣ **Descobrir o IP do Servidor Backend**

No computador **servidor** (onde o backend vai rodar), abra PowerShell e execute:

```powershell
ipconfig
```

Anote o **IPv4 Address** (ex: `192.168.1.100` ou `10.0.0.50`)

---

### 2️⃣ **Configurar o Backend**

**No computador SERVIDOR:**

1. Abra o arquivo `.env` em `backend/.env`
2. Configure as credenciais MySQL corretamente:

```dotenv
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha_aqui
MYSQL_DATABASE=sistema_agendamento

# Adicione isso para permitir CORS de qualquer IP local
CORS_ORIGINS=http://localhost:5173,http://192.168.x.x:5173,http://192.168.x.x:5174
```

Substitua `192.168.x.x` pelo IP real do servidor.

3. Inicie o backend:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

⚠️ **Importante**: Use `--host 0.0.0.0` para permitir conexões de outros computadores!

---

### 3️⃣ **Configurar o Frontend**

**No computador CLIENT** (onde o frontend vai rodar):

1. Abra o arquivo `.env` em `frontend/.env`
2. Aponte para o IP do servidor:

```dotenv
VITE_API_URL=http://192.168.1.100:8000

# Substitua 192.168.1.100 pelo IP REAL do servidor
```

3. Inicie o frontend:

```powershell
cd frontend
npm install
npm run dev
```

4. Acesse `http://localhost:5173` no navegador

---

## 🧪 Testando a Conexão

### Teste 1: Backend respondendo?
Abra `http://192.168.1.100:8000/docs` no navegador

Deve aparecer o swagger com a documentação da API.

### Teste 2: Frontend conectando?
No console do navegador (F12), teste:

```javascript
fetch('http://192.168.1.100:8000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'teste@example.com',
    name: 'Teste',
    password: 'senha123'
  })
})
.then(r => r.json())
.then(d => console.log(d))
```

Se retornar um token, está funcionando! ✅

---

## ❌ Erros Comuns

| Erro | Solução |
|------|---------|
| `ERR_CONNECTION_REFUSED` | Backend não está rodando ou porta errada. Verifique com `netstat -an \|  findstr :8000` |
| `CORS error` | CORS_ORIGINS no `.env` não tem o IP do cliente. Adicione o IP |
| `Connection refused na porta 3306` | MySQL não está rodando. Inicie com `net start MySQL80` |
| Blank page no frontend | Verifique `VITE_API_URL` no `.env` - precisa ter o IP correto |

---

## 🔧 Ambiente de Produção (Recomendado)

Para usar em produção com domínio, altere:

```dotenv
# Backend .env
CORS_ORIGINS=https://seudominio.com,https://www.seudominio.com

# Frontend .env
VITE_API_URL=https://api.seudominio.com
```

---

## 🆘 Precisa de Help?

Se ainda não funcionar, verifique:

1. ✅ MySQL está rodando? → `net start MySQL80`
2. ✅ Backend está respondendo? → `http://backend-ip:8000/`
3. ✅ Firewall aberto na porta 8000? → Windows Defender → Permitir app
4. ✅ IP correto no `.env` do frontend?

