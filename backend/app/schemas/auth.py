from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserRead, validate_password_strength


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=160)
    timezone: str = "Europe/London"
    preferred_currency: str = "GBP"

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("preferred_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        currency = value.upper()
        if currency not in {"GBP", "USD", "NGN"}:
            raise ValueError("Preferred currency must be GBP, USD, or NGN")
        return currency


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthSessionRead(BaseModel):
    user: UserRead
    access_token_expires_at: datetime


class SetupStatusRead(BaseModel):
    owner_exists: bool
    registration_enabled: bool
