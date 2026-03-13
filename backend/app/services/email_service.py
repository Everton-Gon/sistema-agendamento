"""
=============================================================
  email_service.py — Serviço de envio de e-mails
=============================================================
  Responsável por:
  - Enviar convites de reunião por e-mail (com botões aceitar/recusar)
  - Enviar notificações de cancelamento de reunião
  - Incluir link do Microsoft Teams nos convites (quando disponível)
  
  MÉTODO DE ENVIO (prioridade):
  1. Microsoft Graph API (Mail.Send) — mais confiável com Office 365
  2. SMTP com TLS (fallback) — usado se Graph não estiver configurado
  
  Configurações no .env:
  - SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
  - Graph: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, AZURE_ORGANIZER_EMAIL
=============================================================
"""

import smtplib
import httpx
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from datetime import datetime
from app.config import get_settings

settings = get_settings()


class EmailService:
    """
    Serviço singleton para envio de e-mails.
    Usa Graph API (Mail.Send) como método principal e SMTP como fallback.
    """
    
    def __init__(self):
        """Carrega configurações SMTP e Graph do .env."""
        # SMTP (fallback)
        self.smtp_host = getattr(settings, 'smtp_host', 'smtp.gmail.com')
        self.smtp_port = getattr(settings, 'smtp_port', 587)
        self.smtp_user = getattr(settings, 'smtp_user', '')
        self.smtp_password = getattr(settings, 'smtp_password', '')
        self.from_email = getattr(settings, 'email_from', self.smtp_user)
        self.from_name = getattr(settings, 'email_from_name', 'Sistema de Agendamento')
        
        # Graph API (principal)
        self.azure_client_id = getattr(settings, 'azure_client_id', '')
        self.azure_tenant_id = getattr(settings, 'azure_tenant_id', '')
        self.azure_client_secret = getattr(settings, 'azure_client_secret', '')
        self.azure_organizer_email = getattr(settings, 'azure_organizer_email', '')
        
        # Cache de token do Azure AD
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0
    
    def _is_graph_configured(self) -> bool:
        """Verifica se o Graph API está configurado para envio de e-mail."""
        return bool(
            self.azure_client_id and
            self.azure_tenant_id and
            self.azure_client_secret and
            self.azure_organizer_email
        )
    
    def _is_smtp_configured(self) -> bool:
        """Verifica se o SMTP está configurado (fallback)."""
        return bool(self.smtp_user and self.smtp_password)
    
    async def _get_graph_token(self) -> Optional[str]:
        """
        Obtém token de acesso do Azure AD para Graph API.
        Usa cache para evitar chamadas desnecessárias.
        """
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        
        auth_url = f"https://login.microsoftonline.com/{self.azure_tenant_id}/oauth2/v2.0/token"
        auth_data = {
            "client_id": self.azure_client_id,
            "scope": "https://graph.microsoft.com/.default",
            "client_secret": self.azure_client_secret,
            "grant_type": "client_credentials"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(auth_url, data=auth_data)
                response.raise_for_status()
                token_data = response.json()
                
                self._access_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", 3600)
                self._token_expires_at = time.time() + expires_in - 300
                
                return self._access_token
        except Exception as e:
            print(f"[ERROR] Erro ao obter token Azure para email: {e}")
            return None
    
    async def _send_via_graph(self, to_email: str, subject: str, html_body: str) -> bool:
        """
        Envia e-mail via Microsoft Graph API (Mail.Send).
        
        Usa a permissão Mail.Send concedida à aplicação no Azure AD.
        Mais confiável que SMTP com Office 365 (não depende de auth básica).
        """
        token = await self._get_graph_token()
        if not token:
            return False
        
        endpoint = f"https://graph.microsoft.com/v1.0/users/{self.azure_organizer_email}/sendMail"
        
        email_data = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_body
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": to_email
                        }
                    }
                ],
                "from": {
                    "emailAddress": {
                        "address": self.azure_organizer_email,
                        "name": self.from_name
                    }
                }
            },
            "saveToSentItems": False  # Não salva na pasta Enviados (evita spam)
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    },
                    json=email_data,
                    timeout=15.0
                )
                
                if response.status_code == 202:
                    print(f"[OK] E-mail enviado via Graph API para: {to_email}")
                    return True
                else:
                    error = response.json().get("error", {})
                    print(f"[ERROR] Graph Mail.Send falhou ({response.status_code}): {error.get('code')} - {error.get('message')}")
                    return False
        except Exception as e:
            print(f"[ERROR] Erro ao enviar e-mail via Graph: {e}")
            return False
    
    async def _send_via_smtp(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """
        Envia e-mail via SMTP com TLS (método fallback).
        Usado quando Graph API não está disponível.
        """
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            if text_body:
                part1 = MIMEText(text_body, 'plain')
                msg.attach(part1)
            
            part2 = MIMEText(html_body, 'html')
            msg.attach(part2)
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())
            
            print(f"[OK] E-mail enviado via SMTP para: {to_email}")
            return True
            
        except Exception as e:
            print(f"[ERROR] Erro ao enviar e-mail via SMTP para {to_email}: {e}")
            return False
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> bool:
        """
        Envia um e-mail usando o melhor método disponível.
        
        Prioridade:
        1. Graph API (Mail.Send) — mais confiável com Office 365
        2. SMTP (fallback) — se Graph não estiver configurado
        
        Args:
            to_email: Endereço de destino
            subject: Assunto do e-mail
            html_body: Corpo HTML do e-mail
            text_body: Corpo texto puro (fallback, usado só no SMTP)
            
        Returns:
            True se enviou com sucesso, False se falhou
        """
        # Tenta Graph API primeiro (mais confiável com Office 365)
        if self._is_graph_configured():
            result = await self._send_via_graph(to_email, subject, html_body)
            if result:
                return True
            print(f"[WARN] Graph falhou, tentando SMTP como fallback...")
        
        # Fallback: SMTP
        if self._is_smtp_configured():
            return await self._send_via_smtp(to_email, subject, html_body, text_body)
        
        print(f"[WARN] E-mail nao enviado (nenhum metodo configurado): {to_email}")
        return False
    
    async def send_meeting_invitation(
        self,
        to_email: str,
        participant_name: Optional[str],
        meeting_title: str,
        meeting_id: int,
        meeting_date: datetime,
        meeting_start: str,
        meeting_end: str,
        room_name: str,
        organizer_name: str,
        organizer_email: str,
        confirmation_token: str,
        description: Optional[str] = None,
        teams_link: Optional[str] = None
    ) -> bool:
        """
        Envia convite de reunião por e-mail com template HTML.
        
        O e-mail inclui:
        - Detalhes da reunião (título, data, horário, sala, organizador)
        - Botões de aceitar/recusar (geram links para o frontend)
        - Botão "Entrar pelo Teams" (se teams_link estiver disponível)
        - Descrição da reunião (opcional)
        """
        
        date_formatted = meeting_date.strftime("%d/%m/%Y")
        frontend_url = getattr(settings, 'frontend_url', 'http://localhost:5173')
        
        # URLs de confirmação — abrem a página de detalhes no frontend
        # IMPORTANTE: NÃO incluir &response= na URL do e-mail.
        # Motivos:
        # 1. Clientes de e-mail (Outlook, Gmail) fazem "link preview" que consome o token
        #    antes do usuário clicar → link inválido ao clicar de verdade.
        # 2. O participante deve ver os detalhes da reunião antes de confirmar.
        # A confirmação só ocorre quando o usuário clica em "Aceitar" ou "Recusar" na página.
        accept_url = f"{frontend_url}/meeting-response?token={confirmation_token}"
        decline_url = f"{frontend_url}/meeting-response?token={confirmation_token}"
        
        subject = f"📅 Convite para Reunião: {meeting_title}"
        
        # Template HTML do convite
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Cabecalho com gradiente -->
                <div style="background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">📅 Você foi convidado para uma reunião!</h1>
                </div>
                <div style="padding: 30px;">
                    <p>Olá{(' ' + participant_name) if participant_name else ''},</p>
                    <p><strong>{organizer_name}</strong> convidou você para participar de uma reunião.</p>
                    
                    <!-- Card com detalhes da reuniao -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h2 style="margin: 0 0 15px; color: #333; font-size: 20px;">{meeting_title}</h2>
                        <p style="margin: 10px 0; color: #555;">📆 <strong>Data:</strong> {date_formatted}</p>
                        <p style="margin: 10px 0; color: #555;">🕐 <strong>Horário:</strong> {meeting_start} - {meeting_end}</p>
                        <p style="margin: 10px 0; color: #555;">📍 <strong>Sala:</strong> {room_name}</p>
                        <p style="margin: 10px 0; color: #555;">👤 <strong>Organizador:</strong> {organizer_name} ({organizer_email})</p>
                    </div>
                    
                    <!-- Descricao (se informada) -->
                    {f'<div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;"><strong>Descrição:</strong><br>{description}</div>' if description else ''}
                    
                    <p style="margin: 20px 0;"><strong>Por favor, confirme sua participação:</strong></p>
                    
                    <!-- Botoes de aceitar/recusar -->
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="{accept_url}" style="display: inline-block; background: #10b981; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 5px;">
                            ✓ Aceitar
                        </a>
                        <a href="{decline_url}" style="display: inline-block; background: #ef4444; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 5px;">
                            ✗ Recusar
                        </a>
                    </div>
                    
                    <!-- Botao do Teams (se disponivel) -->
                    {f'<div style="text-align: center; margin: 20px 0; padding: 15px; background: #eef2ff; border-radius: 8px;"><p style="margin: 0 0 10px; color: #4338ca; font-weight: bold;">📹 Reunião Online Disponível</p><a href="{teams_link}" style="display: inline-block; background: #5b5fc7; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">🎥 Entrar pelo Teams</a></div>' if teams_link else ''}
                    
                    <p style="color: #666; font-size: 13px; margin-top: 20px;">Em caso de dúvidas, entre em contato com o organizador.</p>
                </div>
                <!-- Rodape -->
                <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>Este e-mail foi enviado automaticamente pelo Sistema de Agendamento de Reunioes.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(to_email, subject, html_body)
    
    async def send_meeting_cancellation(
        self,
        to_email: str,
        participant_name: Optional[str],
        meeting_title: str,
        meeting_date: datetime,
        meeting_start: str,
        organizer_name: str
    ) -> bool:
        """
        Envia notificacao de cancelamento de reuniao.
        Enviado a todos os participantes quando o organizador cancela a reuniao.
        """
        
        date_formatted = meeting_date.strftime("%d/%m/%Y")
        
        subject = f"❌ Reunião Cancelada: {meeting_title}"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: #ef4444; color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">❌ Reunião Cancelada</h1>
                </div>
                <div style="padding: 30px;">
                    <p>Olá{(' ' + participant_name) if participant_name else ''},</p>
                    <p>A reunião <strong>{meeting_title}</strong> agendada para <strong>{date_formatted}</strong> às <strong>{meeting_start}</strong> foi <strong>cancelada</strong> pelo organizador <strong>{organizer_name}</strong>.</p>
                    <p>Caso tenha dúvidas, entre em contato com o organizador.</p>
                </div>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>Este e-mail foi enviado automaticamente pelo Sistema de Agendamento de Reuniões.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(to_email, subject, html_body)


# Instancia singleton — usada em todo o backend
email_service = EmailService()
