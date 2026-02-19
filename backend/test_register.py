import requests
import json

API_URL = "http://localhost:8000/api/auth"

# Teste de registro
register_data = {
    "email": "teste@example.com",
    "name": "Usuário Teste",
    "password": "senha123"
}

print("🧪 Testando registro...")
response = requests.post(f"{API_URL}/register", json=register_data)

print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")
