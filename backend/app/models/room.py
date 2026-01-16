from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class RoomBase(BaseModel):
    name: str
    capacity: int
    resources: List[str] = []
    color: str = "#6366F1"
    is_active: bool = True


class RoomResponse(BaseModel):
    id: int
    name: str
    capacity: int
    resources: List[str]
    color: str
    is_active: bool
    
    class Config:
        from_attributes = True


class RoomAvailability(BaseModel):
    room: RoomResponse
    is_available: bool
    conflicts: List[dict] = []
