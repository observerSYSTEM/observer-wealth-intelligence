from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    __table_args__ = (
        UniqueConstraint(
            "goal_id",
            "source_type",
            "source_id",
            name="uq_goal_contributions_source",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    goal_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("financial_goals.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    contribution_date: Mapped[date] = mapped_column(
        Date,
        index=True,
        nullable=False,
    )
    source_type: Mapped[str] = mapped_column(
        String(40),
        default="manual",
        index=True,
        nullable=False,
    )
    source_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
        nullable=False,
    )
