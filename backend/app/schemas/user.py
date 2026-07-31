from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

SUPPORTED_CURRENCIES = {"GBP", "USD", "NGN"}
SUPPORTED_ROLES = {"owner", "user"}


def validate_password_strength(value: str) -> str:
    checks = [
        any(character.islower() for character in value),
        any(character.isupper() for character in value),
        any(character.isdigit() for character in value),
        any(not character.isalnum() for character in value),
    ]
    if len(value) < 12 or not all(checks):
        raise ValueError(
            "Password must be at least 12 characters and include upper, lower, number, and symbol"
        )
    return value


def validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("Timezone must be a valid IANA timezone") from exc
    return value


def validate_currency(value: str) -> str:
    currency = value.upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise ValueError("Currency must be GBP, USD, or NGN")
    return currency


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=160)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class UserRead(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    role: str
    is_active: bool
    is_verified: bool
    last_login_at: datetime | None
    timezone: str
    preferred_currency: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=160)
    email: EmailStr | None = None
    password_confirmation: str | None = Field(default=None, max_length=128)
    timezone: str | None = None
    preferred_currency: str | None = None

    @field_validator("timezone")
    @classmethod
    def validate_optional_timezone(cls, value: str | None) -> str | None:
        return validate_timezone(value) if value is not None else value

    @field_validator("preferred_currency")
    @classmethod
    def validate_optional_currency(cls, value: str | None) -> str | None:
        return validate_currency(value) if value is not None else value

    @model_validator(mode="after")
    def require_password_for_email_change(self) -> "UserProfileUpdate":
        if self.email is not None and not self.password_confirmation:
            raise ValueError("Password confirmation is required to change email")
        return self


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


class PasswordChangeRead(BaseModel):
    message: str
