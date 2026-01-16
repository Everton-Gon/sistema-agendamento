from typing import List, Optional, Tuple
from datetime import datetime
from beanie import PydanticObjectId
from app.models.meeting import Meeting, MeetingCreate, MeetingResponse, MeetingStatus, CalendarEvent
from app.models.room import Room, RoomResponse
from app.models.user import User
from app.services.graph_service import graph_service
from app.services.email_service import email_service


class MeetingService:
    """Service for meeting management."""
    
    async def check_room_availability(
        self,
        room_id: str,
        start_datetime: datetime,
        end_datetime: datetime,
        exclude_meeting_id: str = None
    ) -> Tuple[bool, Optional[Meeting]]:
        """
        Check if a room is available for the given time slot.
        Returns (is_available, conflicting_meeting).
        """
        query = {
            "room_id": PydanticObjectId(room_id),
            "status": MeetingStatus.SCHEDULED,
            "$or": [
                # New meeting starts during existing meeting
                {
                    "start_datetime": {"$lte": start_datetime},
                    "end_datetime": {"$gt": start_datetime}
                },
                # New meeting ends during existing meeting
                {
                    "start_datetime": {"$lt": end_datetime},
                    "end_datetime": {"$gte": end_datetime}
                },
                # New meeting contains existing meeting
                {
                    "start_datetime": {"$gte": start_datetime},
                    "end_datetime": {"$lte": end_datetime}
                }
            ]
        }
        
        if exclude_meeting_id:
            query["_id"] = {"$ne": PydanticObjectId(exclude_meeting_id)}
        
        conflict = await Meeting.find_one(query)
        
        return (conflict is None, conflict)
    
    async def get_available_rooms(
        self,
        start_datetime: datetime,
        end_datetime: datetime,
        exclude_room_id: str = None
    ) -> List[Room]:
        """Get list of available rooms for the given time slot."""
        all_rooms = await Room.find(Room.is_active == True).to_list()
        available_rooms = []
        
        for room in all_rooms:
            if exclude_room_id and str(room.id) == exclude_room_id:
                continue
            
            is_available, _ = await self.check_room_availability(
                str(room.id),
                start_datetime,
                end_datetime
            )
            
            if is_available:
                available_rooms.append(room)
        
        return available_rooms
    
    async def create_meeting(
        self,
        user: User,
        meeting_data: MeetingCreate
    ) -> Tuple[Optional[Meeting], Optional[dict]]:
        """
        Create a new meeting.
        Returns (meeting, error_response).
        If there's a conflict, returns (None, error_with_suggestions).
        """
        # Check room availability
        is_available, conflict = await self.check_room_availability(
            meeting_data.room_id,
            meeting_data.start_datetime,
            meeting_data.end_datetime
        )
        
        if not is_available:
            # Get available alternatives
            available_rooms = await self.get_available_rooms(
                meeting_data.start_datetime,
                meeting_data.end_datetime,
                meeting_data.room_id
            )
            
            room = await Room.get(PydanticObjectId(meeting_data.room_id))
            conflict_room = await Room.get(conflict.room_id)
            
            return None, {
                "message": f"A sala '{room.name}' já está reservada neste horário.",
                "conflict": {
                    "meeting_title": conflict.title,
                    "start": conflict.start_datetime.isoformat(),
                    "end": conflict.end_datetime.isoformat(),
                    "organizer": conflict.organizer_name
                },
                "available_rooms": [
                    {
                        "id": str(r.id),
                        "name": r.name,
                        "capacity": r.capacity,
                        "color": r.color
                    }
                    for r in available_rooms
                ]
            }
        
        # Get room info
        room = await Room.get(PydanticObjectId(meeting_data.room_id))
        
        # Create meeting
        meeting = Meeting(
            title=meeting_data.title,
            description=meeting_data.description,
            room_id=PydanticObjectId(meeting_data.room_id),
            organizer_id=user.id,
            organizer_email=user.email,
            organizer_name=user.name,
            attendees=meeting_data.attendees,
            start_datetime=meeting_data.start_datetime,
            end_datetime=meeting_data.end_datetime,
            is_recurring=meeting_data.is_recurring,
            recurrence_pattern=meeting_data.recurrence_pattern
        )
        
        await meeting.insert()
        
        # Create event in Outlook calendar
        try:
            if user.access_token:
                attendee_emails = [att.email for att in meeting.attendees]
                
                event = await graph_service.create_calendar_event(
                    access_token=user.access_token,
                    subject=meeting.title,
                    start=meeting.start_datetime,
                    end=meeting.end_datetime,
                    attendees=attendee_emails,
                    body=meeting.description,
                    location=room.name
                )
                
                meeting.microsoft_event_id = event.get("id")
                await meeting.save()
        except Exception as e:
            print(f"Error creating Outlook event: {e}")
        
        # Send email notifications
        await email_service.send_meeting_notification(
            user=user,
            meeting=meeting,
            room_name=room.name,
            action="created"
        )
        
        return meeting, None
    
    async def update_meeting(
        self,
        meeting_id: str,
        user: User,
        update_data: dict
    ) -> Tuple[Optional[Meeting], Optional[dict]]:
        """Update an existing meeting."""
        meeting = await Meeting.get(PydanticObjectId(meeting_id))
        
        if not meeting:
            return None, {"message": "Reunião não encontrada"}
        
        # Check if user is the organizer
        if meeting.organizer_id != user.id:
            return None, {"message": "Apenas o organizador pode editar esta reunião"}
        
        # If changing room or time, check availability
        new_room_id = update_data.get("room_id", str(meeting.room_id))
        new_start = update_data.get("start_datetime", meeting.start_datetime)
        new_end = update_data.get("end_datetime", meeting.end_datetime)
        
        if (new_room_id != str(meeting.room_id) or 
            new_start != meeting.start_datetime or 
            new_end != meeting.end_datetime):
            
            is_available, conflict = await self.check_room_availability(
                new_room_id,
                new_start,
                new_end,
                meeting_id
            )
            
            if not is_available:
                available_rooms = await self.get_available_rooms(
                    new_start,
                    new_end,
                    new_room_id
                )
                
                return None, {
                    "message": "A sala já está reservada neste horário.",
                    "available_rooms": [
                        {"id": str(r.id), "name": r.name, "capacity": r.capacity}
                        for r in available_rooms
                    ]
                }
        
        # Update fields
        for field, value in update_data.items():
            if value is not None and hasattr(meeting, field):
                if field == "room_id":
                    setattr(meeting, field, PydanticObjectId(value))
                else:
                    setattr(meeting, field, value)
        
        meeting.updated_at = datetime.utcnow()
        await meeting.save()
        
        room = await Room.get(meeting.room_id)
        
        # Update Outlook event
        try:
            if user.access_token and meeting.microsoft_event_id:
                await graph_service.update_calendar_event(
                    access_token=user.access_token,
                    event_id=meeting.microsoft_event_id,
                    subject=meeting.title,
                    start=meeting.start_datetime,
                    end=meeting.end_datetime,
                    attendees=[att.email for att in meeting.attendees],
                    body=meeting.description,
                    location=room.name
                )
        except Exception as e:
            print(f"Error updating Outlook event: {e}")
        
        # Send update notification
        await email_service.send_meeting_notification(
            user=user,
            meeting=meeting,
            room_name=room.name,
            action="updated"
        )
        
        return meeting, None
    
    async def cancel_meeting(
        self,
        meeting_id: str,
        user: User
    ) -> Tuple[bool, Optional[dict]]:
        """Cancel a meeting."""
        meeting = await Meeting.get(PydanticObjectId(meeting_id))
        
        if not meeting:
            return False, {"message": "Reunião não encontrada"}
        
        if meeting.organizer_id != user.id:
            return False, {"message": "Apenas o organizador pode cancelar esta reunião"}
        
        meeting.status = MeetingStatus.CANCELLED
        meeting.updated_at = datetime.utcnow()
        await meeting.save()
        
        room = await Room.get(meeting.room_id)
        
        # Delete from Outlook
        try:
            if user.access_token and meeting.microsoft_event_id:
                await graph_service.delete_calendar_event(
                    access_token=user.access_token,
                    event_id=meeting.microsoft_event_id
                )
        except Exception as e:
            print(f"Error deleting Outlook event: {e}")
        
        # Send cancellation notification
        await email_service.send_meeting_notification(
            user=user,
            meeting=meeting,
            room_name=room.name,
            action="cancelled"
        )
        
        return True, None
    
    async def get_user_meetings(
        self,
        user: User,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> List[MeetingResponse]:
        """Get all meetings for a user."""
        query = {
            "$or": [
                {"organizer_id": user.id},
                {"attendees.email": user.email}
            ],
            "status": MeetingStatus.SCHEDULED
        }
        
        if start_date:
            query["start_datetime"] = {"$gte": start_date}
        
        if end_date:
            if "start_datetime" in query:
                query["start_datetime"]["$lte"] = end_date
            else:
                query["start_datetime"] = {"$lte": end_date}
        
        meetings = await Meeting.find(query).sort("+start_datetime").to_list()
        
        result = []
        for meeting in meetings:
            room = await Room.get(meeting.room_id)
            result.append(MeetingResponse.from_document(
                meeting,
                room_name=room.name if room else None,
                room_color=room.color if room else None
            ))
        
        return result
    
    async def get_calendar_events(
        self,
        user: User,
        start_date: datetime,
        end_date: datetime
    ) -> List[CalendarEvent]:
        """Get calendar events for display."""
        meetings = await Meeting.find({
            "status": MeetingStatus.SCHEDULED,
            "start_datetime": {"$gte": start_date, "$lte": end_date}
        }).to_list()
        
        events = []
        for meeting in meetings:
            room = await Room.get(meeting.room_id)
            events.append(CalendarEvent(
                id=str(meeting.id),
                title=meeting.title,
                start=meeting.start_datetime,
                end=meeting.end_datetime,
                room_id=str(meeting.room_id),
                room_name=room.name if room else "Sala desconhecida",
                room_color=room.color if room else "#6366F1",
                organizer_name=meeting.organizer_name,
                is_own_meeting=meeting.organizer_id == user.id
            ))
        
        return events


# Singleton instance
meeting_service = MeetingService()
