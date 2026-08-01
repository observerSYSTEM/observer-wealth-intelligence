from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class OCRResult(Base):
    __tablename__ = "ocr_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    document_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(180), nullable=True)
    recipient: Mapped[str | None] = mapped_column(String(180), nullable=True)
    sender: Mapped[str | None] = mapped_column(String(180), nullable=True)
    extracted_fields_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount_candidates_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    engine_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    engine_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    processing_duration_ms: Mapped[int | None] = mapped_column(nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(default=3, nullable=False)
    failure_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    confidence_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(24),
        default="pending",
        index=True,
        nullable=False,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
