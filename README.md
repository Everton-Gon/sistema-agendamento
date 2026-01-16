# 📅 Sistema de Agendamento de Reuniões

Sistema completo para agendamento de reuniões com integração ao Microsoft Outlook, calendário visual, gerenciamento de 6 salas de reunião, notificações por e-mail e controle de conflitos.

## 🚀 Funcionalidades

- ✅ **Login com Microsoft** - Autenticação OAuth2 com conta Outlook
- ✅ **Calendário Visual** - Visualize todas as reuniões em um calendário intuitivo
- ✅ **6 Salas de Reunião** - Gerencie a disponibilidade de 6 salas diferentes
- ✅ **Controle de Conflitos** - Sistema impede agendamentos duplicados
- ✅ **Sugestões Inteligentes** - Quando há conflito, sugere salas disponíveis
- ✅ **Notificações por E-mail** - Emails automáticos para organizador e participantes
- ✅ **Integração Outlook** - Eventos sincronizados com seu calendário do Outlook
- ✅ **Design Responsivo** - Funciona em desktop, tablet e smartphone

## 🛠️ Tecnologias

### Backend
- **Python 3.10+** - Linguagem principal
- **FastAPI** - Framework web moderno e rápido
- **MongoDB** - Banco de dados NoSQL
- **Beanie ODM** - Object Document Mapper para MongoDB
- **MSAL** - Microsoft Authentication Library
- **Microsoft Graph API** - Integração com Outlook

### Frontend
- **React 18** - Biblioteca UI
- **Vite** - Build tool moderno
- **React Router** - Navegação SPA
- **MSAL React** - Autenticação Microsoft
- **date-fns** - Manipulação de datas
- **Lucide React** - Ícones

## 📋 Pré-requisitos

1. **Python 3.10+** instalado
2. **Node.js 18+** instalado
3. **MongoDB 6.0+** instalado e rodando
4. **Conta Microsoft 365** com permissões de API
5. **Azure AD App Registration** (instruções abaixo)

## ⚙️ Configuração do Azure AD

Para que a autenticação funcione, você precisa registrar um aplicativo no Azure:

1. Acesse o [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Clique em **New Registration**
3. Configure:
   - **Name**: Sistema de Agendamento
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Web - `http://localhost:8000/api/auth/callback`
4. Após criar, copie:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. Vá em **Certificates & secrets** > **New client secret**
   - Copie o **Value** do secret criado
6. Vá em **API permissions** > **Add a permission** > **Microsoft Graph**:
   - Adicione (Delegated): `User.Read`, `Calendars.ReadWrite`, `Mail.Send`, `offline_access`
   - Clique em **Grant admin consent**

## 🚀 Instalação

### 1. Clone o repositório

```bash
cd c:\Users\egoncalves\Downloads\sistema-agendamento
```

### 2. Configure o Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv

# Ativar ambiente (Windows)
.\venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Copiar arquivo de ambiente
copy .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=meeting_scheduler
MICROSOFT_CLIENT_ID=seu-client-id
MICROSOFT_CLIENT_SECRET=seu-client-secret
MICROSOFT_TENANT_ID=seu-tenant-id
JWT_SECRET_KEY=sua-chave-secreta-jwt
```

### 3. Configure o Frontend

```bash
cd ..\frontend

# Instalar dependências
npm install

# Copiar arquivo de ambiente
copy .env.example .env
```

Edite o arquivo `.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_MICROSOFT_CLIENT_ID=seu-client-id
VITE_MICROSOFT_TENANT_ID=seu-tenant-id
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/callback
```

### 4. Inicie os serviços

Terminal 1 - MongoDB (se não estiver rodando como serviço):
```bash
mongod
```

Terminal 2 - Backend:
```bash
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Terminal 3 - Frontend:
```bash
cd frontend
npm run dev
```

### 5. Acesse a aplicação

Abra o navegador em: **http://localhost:5173**

## 📱 Responsividade

O sistema foi desenvolvido para funcionar perfeitamente em:

- 💻 **Desktop** (1024px+) - Layout completo com sidebar
- 📱 **Tablet** (768px - 1024px) - Sidebar compacta
- 📲 **Smartphone** (< 768px) - Menu hambúrguer, layout adaptado

## 🔒 Segurança

- Autenticação via Microsoft OAuth2
- Tokens JWT para sessões
- CORS configurado
- Dados sensíveis criptografados

## 📄 Licença

Este projeto foi desenvolvido para uso interno.

---

Desenvolvido com ❤️ usando React, FastAPI e MongoDB
