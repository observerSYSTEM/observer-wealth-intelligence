from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AutomationCadence = Literal["daily", "weekly"]
BackupTrigger = Literal["manual", "scheduled"]


def validate_hhmm(value: str) -> str:
    parts = value.split(":")
    if len(parts) != 2:
        raise ValueError("Time must be HH:MM")
    hour, minute = parts
    if not hour.isdigit() or not minute.isdigit():
        raise ValueError("Time must be HH:MM")
    hour_number = int(hour)
    minute_number = int(minute)
    if hour_number > 23 or minute_number > 59:
        raise ValueError("Time must be HH:MM")
    return f"{hour_number:02d}:{minute_number:02d}"


class BackupScheduleUpdate(BaseModel):
    enabled: bool
    cadence: AutomationCadence = "daily"
    run_at_time: str = Field(default="02:30", max_length=5)

    @field_validator("run_at_time")
    @classmethod
    def validate_run_at_time(cls, value: str) -> str:
        return validate_hhmm(value)


class AutomationJobRead(BaseModel):
    id: str
    user_id: str
    job_type: str
    name: str
    enabled: bool
    cadence: str
    run_at_time: str
    status: str
    configuration: str | None
    next_run_at: datetime | None
    last_run_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AutomationJobListRead(BaseModel):
    items: list[AutomationJobRead]
    total: int


class BackupRunCreate(BaseModel):
    trigger: BackupTrigger = "manual"


class BackupRunRead(BaseModel):
    id: str
    user_id: str
    job_id: str | None
    trigger: str
    status: str
    backup_filename: str | None
    sha256: str | None
    size_bytes: int
    started_at: datetime
    completed_at: datetime | None
    verified_at: datetime | None
    restore_verified: bool
    verification_message: str | None
    error_message: str | None

    model_config = ConfigDict(from_attributes=True)


class BackupRunListRead(BaseModel):
    items: list[BackupRunRead]
    total: int
    limit: int
    offset: int
