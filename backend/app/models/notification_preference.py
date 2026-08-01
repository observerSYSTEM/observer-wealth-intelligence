from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", name="uq_notification_preferences_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    daily_reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    daily_reminder_time: Mapped[str] = mapped_column(String(5), default="18:00", nullable=False)
    daily_reminder_weekdays: Mapped[str] = mapped_column(
        String(32),
        default="1,2,3,4,5",
        nullable=False,
    )
    weekly_summary_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weekly_summary_weekday: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    weekly_summary_time: Mapped[str] = mapped_column(String(5), default="18:00", nullable=False)
    goal_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ocr_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    backup_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    telegram_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    quiet_hours_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    quiet_hours_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/London", nullable=False)
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
