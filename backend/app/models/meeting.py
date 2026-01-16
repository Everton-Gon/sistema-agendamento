from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import List, Optional
from enum import Enum


class AttendeeStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class Attendee(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    status: AttendeeStatus = AttendeeStatus.PENDING


class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    room_id: int
    attendees: List[Attendee] = []
    start_datetime: datetime
    end_datetime: datetime
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    
    @field_validator('end_datetime')
    @classmethod
    def end_must_be_after_start(cls, v, info):
        if 'start_datetime' in info.data and v <= info.data['start_datetime']:
            raise ValueError('end_datetime must be after start_datetime')
        return v


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    room_id: Optional[int] = None
    attendees: Optional[List[Attendee]] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None


class MeetingResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    room_id: int
    room_name: Optional[str] = None
    room_color: Optional[str] = None
    organizer_id: int
    organizer_email: str
    organizer_name: str
    attendees: List[Attendee]
    start_datetime: datetime
    end_datetime: datetime
    is_recurring: bool
    recurrence_pattern: Optional[str]
    status: MeetingStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConflictResponse(BaseModel):
    message: str
    conflict_meeting: MeetingResponse
    available_rooms: List[dict]


class CalendarEvent(BaseModel):
    id: int
    title: str
    start: datetime
    end: datetime
    room_id: int
    room_name: str
    room_color: str
    organizer_name: str
    is_own_meeting: bool
