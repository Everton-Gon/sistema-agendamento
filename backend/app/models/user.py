from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    microsoft_id: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class TokenData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
