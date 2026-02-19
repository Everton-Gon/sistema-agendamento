import httpx
import time
from typing import Optional, List
from datetime import datetime
from app.config import get_settings

settings = get_settings()


class GraphService:
    """Service for Microsoft Graph API integration using client_credentials."""
    
    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
    
    def __init__(self):
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0
    
    def _is_configured(self) -> bool:
        """Verifica se as credenciais Azure estão configuradas."""
        return bool(
            settings.azure_client_id and 
            settings.azure_tenant_id and 
            settings.azure_client_secret and
            settings.azure_organizer_email
        )
    
    async def _get_access_token(self) -> Optional[str]:
        """Obtém token de acesso via client_credentials flow."""
        if not self._is_configured():
            print("⚠️ Azure/Teams não configurado (credenciais faltando)")
            return None
        
        # Usar token em cache se ainda válido
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        
        auth_url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token"
        auth_data = {
            "client_id": settings.azure_client_id,
            "scope": "https://graph.microsoft.com/.default",
            "client_secret": settings.azure_client_secret,
            "grant_type": "client_credentials"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(auth_url, data=auth_data)
                response.raise_for_status()
                token_data = response.json()
                
                self._access_token = token_data.get("access_token")
                # Token expira em ~3600s, renovar 5 min antes
                expires_in = token_data.get("expires_in", 3600)
                self._token_expires_at = time.time() + expires_in - 300
                
                print("✅ Token Azure obtido com sucesso")
                return self._access_token
                
        except Exception as e:
            print(f"❌ Erro ao obter token Azure: {e}")
            return None
    
    async def create_calendar_event(
        self,
        subject: str,
        start: datetime,
        end: datetime,
        attendees: List[str] = None,
        description: str = None
    ) -> Optional[dict]:
        """Cria um evento de calendário no Outlook/Teams.
        
        Returns:
            dict com 'join_url' (Teams link) e 'event_id', ou None se falhar
        """
        access_token = await self._get_access_token()
        if not access_token:
            return None
        
        event_data = {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": description or ""
            },
            "start": {
                "dateTime": start.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo"
            },
            "end": {
                "dateTime": end.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo"
            },
            "isOnlineMeeting": True,
            "onlineMeetingProvider": "teamsForBusiness"
        }
        
        if attendees:
            event_data["attendees"] = [
                {
                    "emailAddress": {
                        "address": email,
                        "name": email.split('@')[0]
                    },
                    "type": "required"
                }
                for email in attendees
            ]
        
        endpoint = f"{self.GRAPH_API_BASE}/users/{settings.azure_organizer_email}/events"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json=event_data,
                    timeout=30.0
                )
                
                if response.status_code == 201:
                    data = response.json()
                    # O link do Teams fica dentro de onlineMeeting.joinUrl
                    join_url = data.get("onlineMeeting", {}).get("joinUrl")
                    event_id = data.get("id")
                    
                    print(f"✅ Evento Teams criado! Link: {join_url}")
                    return {
                        "join_url": join_url,
                        "event_id": event_id
                    }
                else:
                    error = response.json()
                    print(f"❌ Erro ao criar evento Teams ({response.status_code}): {error}")
                    return None
                    
        except Exception as e:
            print(f"❌ Erro ao criar evento Teams: {e}")
            return None
    
    async def cancel_calendar_event(self, event_id: str) -> bool:
        """Cancela um evento de calendário no Outlook/Teams."""
        access_token = await self._get_access_token()
        if not access_token or not event_id:
            return False
        
        endpoint = f"{self.GRAPH_API_BASE}/users/{settings.azure_organizer_email}/events/{event_id}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    endpoint,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30.0
                )
                if response.status_code == 204:
                    print("✅ Evento Teams cancelado")
                    return True
                else:
                    print(f"❌ Erro ao cancelar evento Teams ({response.status_code})")
                    return False
        except Exception as e:
            print(f"❌ Erro ao cancelar evento Teams: {e}")
            return False


# Singleton instance
graph_service = GraphService()
