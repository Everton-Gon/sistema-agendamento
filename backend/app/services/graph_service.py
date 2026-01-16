import httpx
from typing import Optional, List
from datetime import datetime
from app.config import get_settings
from app.models.user import User

settings = get_settings()


class GraphService:
    """Service for Microsoft Graph API integration."""
    
    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
    
    async def get_user_info(self, access_token: str) -> dict:
        """Get user information from Microsoft Graph."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GRAPH_API_BASE}/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    async def create_calendar_event(
        self,
        access_token: str,
        subject: str,
        start: datetime,
        end: datetime,
        attendees: List[str],
        body: str = None,
        location: str = None
    ) -> dict:
        """Create a calendar event in Outlook."""
        event_data = {
            "subject": subject,
            "start": {
                "dateTime": start.isoformat(),
                "timeZone": "America/Sao_Paulo"
            },
            "end": {
                "dateTime": end.isoformat(),
                "timeZone": "America/Sao_Paulo"
            },
            "attendees": [
                {
                    "emailAddress": {"address": email},
                    "type": "required"
                }
                for email in attendees
            ],
            "isOnlineMeeting": False
        }
        
        if body:
            event_data["body"] = {
                "contentType": "HTML",
                "content": body
            }
        
        if location:
            event_data["location"] = {
                "displayName": location
            }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.GRAPH_API_BASE}/me/events",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=event_data
            )
            response.raise_for_status()
            return response.json()
    
    async def update_calendar_event(
        self,
        access_token: str,
        event_id: str,
        subject: str = None,
        start: datetime = None,
        end: datetime = None,
        attendees: List[str] = None,
        body: str = None,
        location: str = None
    ) -> dict:
        """Update a calendar event in Outlook."""
        event_data = {}
        
        if subject:
            event_data["subject"] = subject
        
        if start:
            event_data["start"] = {
                "dateTime": start.isoformat(),
                "timeZone": "America/Sao_Paulo"
            }
        
        if end:
            event_data["end"] = {
                "dateTime": end.isoformat(),
                "timeZone": "America/Sao_Paulo"
            }
        
        if attendees is not None:
            event_data["attendees"] = [
                {
                    "emailAddress": {"address": email},
                    "type": "required"
                }
                for email in attendees
            ]
        
        if body:
            event_data["body"] = {
                "contentType": "HTML",
                "content": body
            }
        
        if location:
            event_data["location"] = {
                "displayName": location
            }
        
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{self.GRAPH_API_BASE}/me/events/{event_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=event_data
            )
            response.raise_for_status()
            return response.json()
    
    async def delete_calendar_event(self, access_token: str, event_id: str) -> bool:
        """Delete a calendar event from Outlook."""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.GRAPH_API_BASE}/me/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            return response.status_code == 204
    
    async def send_email(
        self,
        access_token: str,
        to_emails: List[str],
        subject: str,
        body: str,
        cc_emails: List[str] = None
    ) -> bool:
        """Send an email using Microsoft Graph API."""
        message = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": body
                },
                "toRecipients": [
                    {"emailAddress": {"address": email}}
                    for email in to_emails
                ]
            },
            "saveToSentItems": True
        }
        
        if cc_emails:
            message["message"]["ccRecipients"] = [
                {"emailAddress": {"address": email}}
                for email in cc_emails
            ]
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.GRAPH_API_BASE}/me/sendMail",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=message
            )
            return response.status_code == 202


# Singleton instance
graph_service = GraphService()
