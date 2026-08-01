from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class BackupSettings(Base):
    __tablename__ = "backup_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_backup_settings_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    frequency: Mapped[str] = mapped_column(String(16), default="daily", nullable=False)
    run_time: Mapped[str] = mapped_column(String(5), default="02:00", nullable=False)
    weekday: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retention_daily: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    retention_weekly: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    retention_monthly: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    backup_path: Mapped[str] = mapped_column(String(255), default="data/backups", nullable=False)
    include_secrets: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_failure_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
