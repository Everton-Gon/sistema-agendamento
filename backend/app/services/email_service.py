import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from datetime import datetime
from app.config import get_settings

settings = get_settings()


class EmailService:
    """Serviço para envio de e-mails."""
    
    def __init__(self):
        self.smtp_host = getattr(settings, 'smtp_host', 'smtp.gmail.com')
        self.smtp_port = getattr(settings, 'smtp_port', 587)
        self.smtp_user = getattr(settings, 'smtp_user', '')
        self.smtp_password = getattr(settings, 'smtp_password', '')
        self.from_email = getattr(settings, 'email_from', self.smtp_user)
        self.from_name = getattr(settings, 'email_from_name', 'Sistema de Agendamento')
    
    def _is_configured(self) -> bool:
        """Verifica se o serviço de e-mail está configurado."""
        return bool(self.smtp_user and self.smtp_password)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> bool:
        """Envia um e-mail."""
        if not self._is_configured():
            print(f"⚠️ E-mail não enviado (SMTP não configurado): {to_email}")
            return False
        
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
            
            print(f"✅ E-mail enviado para: {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Erro ao enviar e-mail para {to_email}: {e}")
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
        """Envia convite de reunião por e-mail."""
        
        date_formatted = meeting_date.strftime("%d/%m/%Y")
        frontend_url = getattr(settings, 'frontend_url', 'http://localhost:5173')
        
        # URLs de confirmação - apontam para o frontend
        accept_url = f"{frontend_url}/meeting-response?token={confirmation_token}&response=accept"
        decline_url = f"{frontend_url}/meeting-response?token={confirmation_token}&response=decline"
        
        subject = f"📅 Convite para Reunião: {meeting_title}"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #f3b86b 0%, #fa993f 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">📅 Você foi convidado para uma reunião!</h1>
                </div>
                <div style="padding: 30px;">
                    <p>Olá{(' ' + participant_name) if participant_name else ''},</p>
                    <p><strong>{organizer_name}</strong> convidou você para participar de uma reunião.</p>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h2 style="margin: 0 0 15px; color: #333; font-size: 20px;">{meeting_title}</h2>
                        <p style="margin: 10px 0; color: #555;">📆 <strong>Data:</strong> {date_formatted}</p>
                        <p style="margin: 10px 0; color: #555;">🕐 <strong>Horário:</strong> {meeting_start} - {meeting_end}</p>
                        <p style="margin: 10px 0; color: #555;">📍 <strong>Sala:</strong> {room_name}</p>
                        <p style="margin: 10px 0; color: #555;">👤 <strong>Organizador:</strong> {organizer_name} ({organizer_email})</p>
                    </div>
                    
                    {f'<div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;"><strong>Descrição:</strong><br>{description}</div>' if description else ''}
                    
                    <p style="margin: 20px 0;"><strong>Por favor, confirme sua participação:</strong></p>
                    
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="{accept_url}" style="display: inline-block; background: #10b981; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 5px;">
                            ✓ Aceitar
                        </a>
                        <a href="{decline_url}" style="display: inline-block; background: #ef4444; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 5px;">
                            ✗ Recusar
                        </a>
                    </div>
                    
                    {f'<div style="text-align: center; margin: 20px 0; padding: 15px; background: #eef2ff; border-radius: 8px;"><p style="margin: 0 0 10px; color: #4338ca; font-weight: bold;">📹 Reunião Online Disponível</p><a href="{teams_link}" style="display: inline-block; background: #5b5fc7; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">🎥 Entrar pelo Teams</a></div>' if teams_link else ''}
                    
                    <p style="color: #666; font-size: 13px; margin-top: 20px;">Em caso de dúvidas, entre em contato com o organizador.</p>
                </div>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>Este e-mail foi enviado automaticamente pelo Sistema de Agendamento de Reuniões.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Você foi convidado para uma reunião!

Reunião: {meeting_title}
Data: {date_formatted}
Horário: {meeting_start} - {meeting_end}
Sala: {room_name}
Organizador: {organizer_name} ({organizer_email})
{f'Descrição: {description}' if description else ''}

Para ACEITAR: {accept_url}
Para RECUSAR: {decline_url}
{f'Entrar pelo Teams: {teams_link}' if teams_link else ''}
"""
        
        return await self.send_email(to_email, subject, html_body, text_body)
    
    async def send_meeting_cancellation(
        self,
        to_email: str,
        participant_name: Optional[str],
        meeting_title: str,
        meeting_date: datetime,
        meeting_start: str,
        organizer_name: str
    ) -> bool:
        """Envia notificação de cancelamento de reunião."""
        
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


# Instância singleton
email_service = EmailService()
