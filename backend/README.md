# Backend - Sistema de Agendamento de Reuniões

## Requisitos

- Python 3.10+
- MongoDB 6.0+
- Conta Microsoft 365 com permissões de API

## Instalação

```bash
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente (Windows)
.\venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`
2. Configure as variáveis de ambiente com suas credenciais

## Executar

```bash
uvicorn app.main:app --reload --port 8000
```

## API Docs

Acesse `http://localhost:8000/docs` para a documentação interativa.
