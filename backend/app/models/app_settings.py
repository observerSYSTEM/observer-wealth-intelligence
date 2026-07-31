from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    registration_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    default_timezone: Mapped[str] = mapped_column(
        String(64),
        default="Europe/London",
        nullable=False,
    )
    default_currency: Mapped[str] = mapped_column(String(3), default="GBP", nullable=False)
    savings_percentage: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    business_percentage: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    living_percentage: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    primary_goal_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        default=Decimal("100000.00"),
        nullable=False,
    )
    primary_goal_currency: Mapped[str] = mapped_column(String(3), default="GBP", nullable=False)
    receipt_ocr_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    theme_preference: Mapped[str] = mapped_column(String(16), default="system", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
