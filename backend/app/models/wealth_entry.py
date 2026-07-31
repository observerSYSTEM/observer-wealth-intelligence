from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class WealthEntry(Base):
    __tablename__ = "wealth_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_wealth_entries_user_idempotency"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    entry_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    income_source: Mapped[str] = mapped_column(String(24), index=True, nullable=False)
    realised_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), index=True, nullable=False)
    savings_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    business_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    living_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    recommended_savings: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    recommended_business: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    recommended_living: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    actual_savings: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    actual_business: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    actual_living: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    savings_variance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    discipline_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    transfer_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    receipt_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("receipts.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
    )
    idempotency_key: Mapped[str] = mapped_column(String(80), nullable=False)
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
