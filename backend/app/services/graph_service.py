"""
=============================================================
  graph_service.py — Integração com Microsoft Graph API
=============================================================
  Responsável por:
  - Autenticar no Azure AD via client_credentials flow
  - Criar eventos de calendário no Outlook com reunião Teams
  - Cancelar eventos de calendário no Outlook/Teams
  
  O serviço usa a API do Microsoft Graph v1.0:
  https://graph.microsoft.com/v1.0
  
  Configurações no .env:
  - AZURE_CLIENT_ID: ID da aplicação registrada no Azure AD
  - AZURE_TENANT_ID: ID do tenant (organização)
  - AZURE_CLIENT_SECRET: Chave secreta da aplicação
  - AZURE_ORGANIZER_EMAIL: E-mail do organizador (dono do calendário)
=============================================================
"""

import httpx
import time
from typing import Optional, List
from datetime import datetime
from app.config import get_settings

settings = get_settings()


class GraphService:
    """
    Serviço singleton para integração com Microsoft Graph API.
    
    Cria eventos de calendário no Outlook/Teams usando o fluxo
    client_credentials (aplicação → aplicação, sem interação do usuário).
    """
    
    # URL base da API do Microsoft Graph
    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
    
    def __init__(self):
        """Inicializa com cache de token vazio."""
        self._access_token: Optional[str] = None   # Token de acesso em cache
        self._token_expires_at: float = 0            # Timestamp de expiração do token
    
    def _is_configured(self) -> bool:
        """
        Verifica se as credenciais Azure estão configuradas no .env.
        Todas as 4 variáveis precisam estar preenchidas.
        
        Returns:
            True se configurado, False se faltam credenciais
        """
        return bool(
            settings.azure_client_id and 
            settings.azure_tenant_id and 
            settings.azure_client_secret and
            settings.azure_organizer_email
        )
    
    async def _get_access_token(self) -> Optional[str]:
        """
        Obtém token de acesso via OAuth2 client_credentials flow.
        
        Fluxo:
        1. Verifica se há token em cache ainda válido → retorna direto
        2. Se não, faz POST para o endpoint de token do Azure AD
        3. Armazena o novo token em cache com expiração
        
        O token expira em ~3600s (1 hora). Renovamos 5 minutos antes.
        
        Returns:
            String do access_token, ou None se falhar
        """
        if not self._is_configured():
            print("[WARN] Azure/Teams nao configurado (credenciais faltando)")
            return None
        
        # Usa token em cache se ainda válido (economiza chamadas ao Azure)
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        
        # Endpoint OAuth2 do Azure AD para o tenant da organização
        auth_url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token"
        
        # Dados para solicitar o token
        auth_data = {
            "client_id": settings.azure_client_id,
            "scope": "https://graph.microsoft.com/.default",  # Permissões definidas no Azure Portal
            "client_secret": settings.azure_client_secret,
            "grant_type": "client_credentials"                 # Fluxo sem interação do usuário
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(auth_url, data=auth_data)
                response.raise_for_status()
                token_data = response.json()
                
                # Armazena token em cache
                self._access_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", 3600)
                self._token_expires_at = time.time() + expires_in - 300  # Renova 5 min antes
                
                print("[OK] Token Azure obtido com sucesso")
                return self._access_token
                
        except Exception as e:
            print(f"[ERROR] Erro ao obter token Azure: {e}")
            return None
    
    async def create_calendar_event(
        self,
        subject: str,
        start: datetime,
        end: datetime,
        attendees: List[str] = None,
        description: str = None,
        room_name: str = None
    ) -> Optional[dict]:
        """
        Cria um evento de calendário no Outlook/Teams.
        
        O evento é criado no calendário do organizador (AZURE_ORGANIZER_EMAIL)
        com a opção isOnlineMeeting=True, o que gera automaticamente um link
        do Microsoft Teams.
        
        Participantes recebem convite oficial do Outlook com aceitar/recusar.
        
        Args:
            subject: Título do evento/reunião
            start: Data/hora de início
            end: Data/hora de fim
            attendees: Lista de e-mails dos participantes (opcional)
            description: Descrição/corpo do evento (opcional)
            
        Returns:
            dict com 'join_url' (link Teams) e 'event_id' (ID do evento),
            ou None se falhar
        """
        access_token = await self._get_access_token()
        if not access_token:
            return None
        
        # Monta o payload do evento seguindo a especificação do Graph API
        event_data = {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": description or ""
            },
            "start": {
                "dateTime": start.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo"          # Fuso horário de Brasília
            },
            "end": {
                "dateTime": end.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo"
            },
            "isOnlineMeeting": True,                      # Gera link do Teams automaticamente
            "onlineMeetingProvider": "teamsForBusiness"    # Usa Teams for Business
        }
        
        # Adiciona a sala como local do evento
        if room_name:
            event_data["location"] = {
                "displayName": room_name
            }
        
        # Adiciona participantes como "required attendees"
        if attendees:
            event_data["attendees"] = [
                {
                    "emailAddress": {
                        "address": email,
                        "name": email.split('@')[0]       # Usa parte antes do @ como nome
                    },
                    "type": "required"                     # Presença obrigatória
                }
                for email in attendees
            ]
        
        # Endpoint: cria evento no calendário do organizador
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
                    timeout=30.0                           # Timeout de 30 segundos
                )
                
                if response.status_code == 201:            # 201 = Created
                    data = response.json()
                    # O link do Teams fica em onlineMeeting.joinUrl
                    join_url = data.get("onlineMeeting", {}).get("joinUrl")
                    event_id = data.get("id")              # ID para cancelamento futuro
                    
                    print(f"[OK] Evento Teams criado! Link: {join_url}")
                    return {
                        "join_url": join_url,
                        "event_id": event_id
                    }
                else:
                    error = response.json()
                    print(f"[ERROR] Erro ao criar evento Teams ({response.status_code}): {error}")
                    return None
                    
        except Exception as e:
            print(f"[ERROR] Erro ao criar evento Teams: {e}")
            return None
    
    async def update_calendar_event(
        self,
        event_id: str,
        subject: str = None,
        start: datetime = None,
        end: datetime = None,
        attendees: List[str] = None,
        description: str = None,
        room_name: str = None
    ) -> bool:
        """
        Atualiza um evento existente no calendário do Outlook/Teams.
        
        Usa PATCH para atualizar apenas os campos alterados.
        O link do Teams é preservado automaticamente.
        
        Args:
            event_id: ID do evento no Microsoft Graph (teams_event_id)
            subject: Novo título (opcional)
            start: Nova data/hora de início (opcional)
            end: Nova data/hora de fim (opcional)
            attendees: Nova lista de e-mails dos participantes (opcional)
            description: Nova descrição (opcional)
            room_name: Nome da sala para o local do evento (opcional)
            
        Returns:
            True se atualizou com sucesso, False se falhou
        """
        access_token = await self._get_access_token()
        if not access_token or not event_id:
            return False
        
        # Monta payload apenas com os campos que foram passados
        event_data = {}
        
        if subject is not None:
            event_data["subject"] = subject
        
        if description is not None:
            event_data["body"] = {
                "contentType": "HTML",
                "content": description
            }
        
        if start is not None:
            event_data["start"] = {
                "dateTime": start.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo"
            }
        
        if end is not None:
            event_data["end"] = {
                "dateTime": end.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "America/Sao_Paulo"
            }
        
        if room_name is not None:
            event_data["location"] = {
                "displayName": room_name
            }
        
        if attendees is not None:
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
        
        if not event_data:
            return True  # Nada para atualizar
        
        endpoint = f"{self.GRAPH_API_BASE}/users/{settings.azure_organizer_email}/events/{event_id}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json=event_data,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    print(f"[OK] Evento Teams atualizado: {event_id[:20]}...")
                    return True
                else:
                    error = response.json()
                    print(f"[ERROR] Erro ao atualizar evento Teams ({response.status_code}): {error}")
                    return False
                    
        except Exception as e:
            print(f"[ERROR] Erro ao atualizar evento Teams: {e}")
            return False

    async def cancel_calendar_event(self, event_id: str) -> bool:
        """
        Cancela (deleta) um evento de calendário no Outlook/Teams.
        
        Chamado automaticamente quando o organizador cancela uma reunião.
        O Microsoft 365 envia notificação de cancelamento aos participantes.
        
        Args:
            event_id: ID do evento retornado por create_calendar_event()
            
        Returns:
            True se cancelou com sucesso, False se falhou
        """
        access_token = await self._get_access_token()
        if not access_token or not event_id:
            return False
        
        # Endpoint: deleta evento do calendário do organizador
        endpoint = f"{self.GRAPH_API_BASE}/users/{settings.azure_organizer_email}/events/{event_id}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    endpoint,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=30.0
                )
                if response.status_code == 204:           # 204 = No Content (sucesso)
                    print("[OK] Evento Teams cancelado")
                    return True
                else:
                    print(f"[ERROR] Erro ao cancelar evento Teams ({response.status_code})")
                    return False
        except Exception as e:
            print(f"[ERROR] Erro ao cancelar evento Teams: {e}")
            return False
    
    async def get_calendar_events(
        self,
        start: datetime,
        end: datetime
    ) -> list:
        """
        Busca eventos do calendario do Outlook/Teams em um periodo.
        
        Usa o endpoint calendarView do Graph API que retorna todos os eventos
        (incluindo recorrentes expandidos) entre as datas informadas.
        
        Args:
            start: Data/hora de inicio do periodo
            end: Data/hora de fim do periodo
            
        Returns:
            Lista de dicts com dados dos eventos, ou lista vazia se falhar
        """
        access_token = await self._get_access_token()
        if not access_token:
            return []
        
        # Formata datas no padrao ISO 8601 para a API
        start_str = start.strftime("%Y-%m-%dT%H:%M:%S")
        end_str = end.strftime("%Y-%m-%dT%H:%M:%S")
        
        # calendarView retorna eventos expandidos (recorrentes viram individuais)
        endpoint = (
            f"{self.GRAPH_API_BASE}/users/{settings.azure_organizer_email}"
            f"/calendarView?startDateTime={start_str}&endDateTime={end_str}"
            f"&$select=subject,start,end,organizer,isOnlineMeeting,isCancelled,iCalUId"
            f"&$orderby=start/dateTime"
            f"&$top=50"
        )
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "Prefer": 'outlook.timezone="America/Sao_Paulo"'
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    events = data.get("value", [])
                    # Filtra eventos cancelados (desmarcados no Outlook/Teams)
                    events = [e for e in events if not e.get("isCancelled", False)]
                    print(f"[OK] Encontrados {len(events)} eventos no Outlook ({start_str} a {end_str})")
                    return events
                else:
                    error = response.json()
                    print(f"[ERROR] Erro ao buscar eventos Outlook ({response.status_code}): {error}")
                    return []
                    
        except Exception as e:
            print(f"[ERROR] Erro ao buscar eventos Outlook: {e}")
            return []
    
    async def get_room_calendar_events(
        self,
        room_email: str,
        start: datetime,
        end: datetime
    ) -> list:
        """
        Busca eventos do calendário de uma SALA específica no Outlook.
        
        Usa o email da Room Mailbox (ex: salareuniao02@email.com.br)
        para buscar via /users/{room_email}/calendarView.
        
        Requer permissão Calendars.Read no Azure AD (application scope).
        
        Args:
            room_email: Email da sala (Room Mailbox) no Microsoft 365
            start: Data/hora de início do período
            end: Data/hora de fim do período
            
        Returns:
            Lista de dicts com dados dos eventos, ou lista vazia se falhar
        """
        access_token = await self._get_access_token()
        if not access_token:
            return []
        
        start_str = start.strftime("%Y-%m-%dT%H:%M:%S")
        end_str = end.strftime("%Y-%m-%dT%H:%M:%S")
        
        endpoint = (
            f"{self.GRAPH_API_BASE}/users/{room_email}"
            f"/calendarView?startDateTime={start_str}&endDateTime={end_str}"
            f"&$select=subject,start,end,organizer,isOnlineMeeting,isCancelled,iCalUId"
            f"&$orderby=start/dateTime"
            f"&$top=50"
        )
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "Prefer": 'outlook.timezone="America/Sao_Paulo"'
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    events = data.get("value", [])
                    # Filtra eventos cancelados
                    events = [e for e in events if not e.get("isCancelled", False)]
                    print(f"[OK] Sala {room_email}: {len(events)} eventos encontrados ({start_str[:10]})")
                    return events
                else:
                    error = response.json()
                    print(f"[ERROR] Erro ao buscar eventos da sala {room_email} ({response.status_code}): {error.get('error', {}).get('message', '')}")
                    return []
                    
        except Exception as e:
            print(f"[ERROR] Erro ao buscar eventos da sala {room_email}: {e}")
            return []
    
    async def check_calendar_conflict(
        self,
        start: datetime,
        end: datetime
    ) -> Optional[dict]:
        """
        Verifica se ha conflito de horario no calendario do Outlook/Teams.
        
        Busca eventos no periodo e verifica se algum sobrepoe o horario desejado.
        Retorna o primeiro evento conflitante encontrado, ou None se livre.
        
        Args:
            start: Data/hora de inicio da reuniao desejada
            end: Data/hora de fim da reuniao desejada
            
        Returns:
            Dict com dados do evento conflitante, ou None se nao ha conflito
        """
        events = await self.get_calendar_events(start, end)
        
        for event in events:
            # Parse das datas do evento do Outlook
            event_start_str = event.get("start", {}).get("dateTime", "")
            event_end_str = event.get("end", {}).get("dateTime", "")
            
            if not event_start_str or not event_end_str:
                continue
            
            # Remove microssegundos extras do Graph API (ex: ".0000000")
            event_start_str = event_start_str.split(".")[0]
            event_end_str = event_end_str.split(".")[0]
            
            try:
                event_start = datetime.fromisoformat(event_start_str)
                event_end = datetime.fromisoformat(event_end_str)
            except ValueError:
                continue
            
            # Verifica sobreposicao: evento comeca antes do fim E termina depois do inicio
            if event_start < end and event_end > start:
                subject = event.get("subject", "Evento sem titulo")
                organizer = event.get("organizer", {}).get("emailAddress", {}).get("name", "Desconhecido")
                print(f"[WARN] Conflito com evento Outlook: '{subject}' ({event_start} - {event_end})")
                return {
                    "title": subject,
                    "start": event_start.isoformat(),
                    "end": event_end.isoformat(),
                    "organizer": organizer,
                    "source": "outlook"
                }
        
        return None


    async def check_event_exists(self, event_id: str) -> bool:
        """
        Verifica se um evento ainda existe e está ativo no calendário do Outlook.

        Usado pelo job de polling para detectar reuniões canceladas externamente
        (direto no Outlook/Teams, sem passar pelo sistema).

        Args:
            event_id: ID do evento no Microsoft Graph (teams_event_id)

        Returns:
            True  → evento existe e está ativo (não cancelado)
            False → evento foi deletado ou isCancelled=true no Outlook
        """
        access_token = await self._get_access_token()
        if not access_token:
            return True  # Se não conseguir token, assume que existe (evita falso-positivo)

        endpoint = (
            f"{self.GRAPH_API_BASE}/users/{settings.azure_organizer_email}"
            f"/events/{event_id}?$select=id,isCancelled"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=8.0
                )

                if response.status_code == 200:
                    data = response.json()
                    # isCancelled=True → cancelado externamente
                    return not data.get("isCancelled", False)

                if response.status_code == 404:
                    # Evento foi deletado no Outlook
                    return False

                # Qualquer outro erro → assume que existe (evita falso-positivo)
                return True
        except Exception as e:
            print(f"[WARN] Erro ao verificar evento {event_id}: {e}")
            return True  # Em caso de erro, não cancela (segurança)

    async def get_event_details(self, event_id: str) -> Optional[dict]:
        """
        Busca detalhes completos de um evento, incluindo o iCalUId.
        """
        access_token = await self._get_access_token()
        if not access_token:
            return None

        endpoint = (
            f"{self.GRAPH_API_BASE}/users/{settings.azure_organizer_email}"
            f"/events/{event_id}?$select=id,subject,iCalUId,start,end"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=8.0
                )
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception as e:
            print(f"[ERROR] Falha ao obter detalhes do evento {event_id}: {e}")
            return None


    async def search_users_in_directory(self, query: str) -> List[dict]:
        """
        Busca usuários no diretório do Microsoft 365 (Azure AD).

        Retorna todos os funcionários da organização que casam com o nome
        ou e-mail digitado, mesmo que nunca tenham feito login no sistema.

        Usa o endpoint /users com $search para busca sem distinção de maiúsculas.
        Requer permissão: User.Read.All (application scope) no Azure AD.

        Args:
            query: Texto digitado pelo usuário (nome ou parte do e-mail)

        Returns:
            Lista de dicts com { name, email } — até 10 resultados
        """
        access_token = await self._get_access_token()
        if not access_token:
            return []

        # Graph API: busca por displayName OU mail contendo o texto
        endpoint = (
            f"{self.GRAPH_API_BASE}/users"
            f"?$search=\"displayName:{query}\" OR \"mail:{query}\""
            f"&$select=displayName,mail,userPrincipalName"
            f"&$filter=accountEnabled eq true"
            f"&$top=10"
            f"&$orderby=displayName"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        # ConsistencyLevel é obrigatório para usar $search no Graph API
                        "ConsistencyLevel": "eventual"
                    },
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    users = data.get("value", [])
                    result = []
                    for u in users:
                        email = u.get("mail") or u.get("userPrincipalName", "")
                        name = u.get("displayName", "")
                        # Exclui contas de serviço sem e-mail válido
                        if email and "@" in email and name:
                            result.append({"name": name, "email": email})
                    print(f"[OK] Azure AD: {len(result)} usuários encontrados para '{query}'")
                    return result
                else:
                    error = response.json()
                    print(f"[WARN] Azure AD search falhou ({response.status_code}): {error.get('error', {}).get('message', '')}")
                    return []

        except Exception as e:
            print(f"[WARN] Erro ao buscar no Azure AD: {e}")
            return []


# Instancia singleton -- usada em todo o backend
graph_service = GraphService()
