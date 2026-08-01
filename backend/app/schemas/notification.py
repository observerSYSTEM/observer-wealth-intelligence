from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.asset import normalize_text

NotificationType = Literal[
    "daily_entry_reminder",
    "weekly_summary",
    "goal_progress",
    "goal_completed",
    "ocr_review_pending",
    "backup_success",
    "backup_failure",
    "security_event",
    "system",
]
NotificationChannel = Literal["in_app", "telegram"]
NotificationSeverity = Literal["info", "success", "warning", "critical"]
NotificationStatus = Literal["pending", "sent", "failed", "cancelled", "read"]


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=2000)
    type: NotificationType = "system"
    channel: NotificationChannel = "in_app"
    severity: NotificationSeverity = "info"
    related_type: str | None = Field(default=None, max_length=48)
    related_id: str | None = Field(default=None, max_length=36)
    deduplication_key: str | None = Field(default=None, max_length=160)
    scheduled_for: datetime | None = None

    @field_validator("title", "message", "related_type", "deduplication_key")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return normalize_text(value)


class NotificationRead(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str
    channel: str
    severity: str
    status: str
    related_type: str | None
    related_id: str | None
    telegram_message_id: str | None
    failure_reason: str | None
    deduplication_key: str | None
    scheduled_for: datetime | None
    sent_at: datetime | None
    read_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListRead(BaseModel):
    items: list[NotificationRead]
    total: int
    unread_count: int
    limit: int
    offset: int


class NotificationPreferenceUpdate(BaseModel):
    daily_reminder_enabled: bool | None = None
    daily_reminder_time: str | None = None
    daily_reminder_weekdays: str | None = Field(default=None, max_length=32)
    weekly_summary_enabled: bool | None = None
    weekly_summary_weekday: int | None = Field(default=None, ge=1, le=7)
    weekly_summary_time: str | None = None
    goal_alerts_enabled: bool | None = None
    ocr_alerts_enabled: bool | None = None
    backup_alerts_enabled: bool | None = None
    telegram_enabled: bool | None = None
    telegram_chat_id: str | None = Field(default=None, max_length=80)
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator(
        "daily_reminder_time",
        "weekly_summary_time",
        "quiet_hours_start",
        "quiet_hours_end",
    )
    @classmethod
    def validate_optional_time(cls, value: str | None) -> str | None:
        if value is None:
            return value
        parts = value.split(":")
        if len(parts) != 2 or not all(part.isdigit() for part in parts):
            raise ValueError("Time must be HH:MM")
        hour, minute = (int(part) for part in parts)
        if hour > 23 or minute > 59:
            raise ValueError("Time must be HH:MM")
        return f"{hour:02d}:{minute:02d}"

    @field_validator("telegram_chat_id")
    @classmethod
    def validate_chat_id(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not value.removeprefix("-").isdigit():
            raise ValueError("Telegram chat ID must be numeric")
        return value


class NotificationPreferenceRead(BaseModel):
    id: str
    user_id: str
    daily_reminder_enabled: bool
    daily_reminder_time: str
    daily_reminder_weekdays: str
    weekly_summary_enabled: bool
    weekly_summary_weekday: int
    weekly_summary_time: str
    goal_alerts_enabled: bool
    ocr_alerts_enabled: bool
    backup_alerts_enabled: bool
    telegram_enabled: bool
    telegram_chat_id: str | None
    quiet_hours_start: str | None
    quiet_hours_end: str | None
    timezone: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
