from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.automation import (
    BackupRunListRead as AutomationBackupRunListRead,
)
from app.schemas.automation import (
    BackupRunRead as AutomationBackupRunRead,
)
from app.schemas.automation import (
    validate_hhmm,
)

BackupFrequency = Literal["daily", "weekly", "monthly", "disabled"]
BackupRunRead = AutomationBackupRunRead
BackupRunListRead = AutomationBackupRunListRead


class BackupSettingsUpdate(BaseModel):
    enabled: bool | None = None
    frequency: BackupFrequency | None = None
    run_time: str | None = None
    weekday: int | None = Field(default=None, ge=1, le=7)
    month_day: int | None = Field(default=None, ge=1, le=31)
    retention_daily: int | None = Field(default=None, ge=1, le=365)
    retention_weekly: int | None = Field(default=None, ge=1, le=104)
    retention_monthly: int | None = Field(default=None, ge=1, le=120)
    backup_path: str | None = Field(default=None, max_length=255)
    include_secrets: bool | None = None

    @field_validator("run_time")
    @classmethod
    def validate_run_time(cls, value: str | None) -> str | None:
        return validate_hhmm(value) if value is not None else value


class BackupSettingsRead(BaseModel):
    id: str
    user_id: str
    enabled: bool
    frequency: str
    run_time: str
    weekday: int | None
    month_day: int | None
    retention_daily: int
    retention_weekly: int
    retention_monthly: int
    backup_path: str
    include_secrets: bool
    last_success_at: datetime | None
    last_failure_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BackupRunCreate(BaseModel):
    trigger: Literal["manual", "scheduled"] = "manual"
    dry_run: bool = False


class BackupVerifyRequest(BaseModel):
    backup_id: str | None = None
    latest: bool = True


class BackupStatusRead(BaseModel):
    settings: BackupSettingsRead
    latest_backup: BackupRunRead | None
    latest_success: BackupRunRead | None
    latest_failure: BackupRunRead | None
