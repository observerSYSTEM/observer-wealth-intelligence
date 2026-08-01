from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.entry import money
from app.schemas.user import validate_currency

OCRSourceType = Literal["receipt", "vault_document"]
OCRStatus = Literal["pending", "processing", "review_required", "confirmed", "failed", "cancelled"]


class OCRJobCreate(BaseModel):
    source_type: OCRSourceType
    source_id: str


class OCRResultConfirm(BaseModel):
    amount: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=18)
    currency: str | None = None
    document_date: date | None = None
    document_time: str | None = Field(default=None, max_length=8)
    reference: str | None = Field(default=None, max_length=180)
    recipient: str | None = Field(default=None, max_length=180)
    sender: str | None = Field(default=None, max_length=180)
    status: OCRStatus = "confirmed"

    @field_validator("amount")
    @classmethod
    def round_amount(cls, value: Decimal | None) -> Decimal | None:
        return money(value) if value is not None else value

    @field_validator("currency")
    @classmethod
    def validate_optional_currency(cls, value: str | None) -> str | None:
        return validate_currency(value) if value is not None else value


class OCRResultRead(BaseModel):
    id: str
    user_id: str
    source_type: str
    source_id: str
    extracted_text: str | None
    amount: Decimal | None
    currency: str | None
    document_date: date | None
    document_time: str | None
    reference: str | None
    recipient: str | None
    sender: str | None
    extracted_fields: dict[str, Any] = Field(default_factory=dict)
    amount_candidates: list[dict[str, Any]] = Field(default_factory=list)
    engine_name: str | None
    engine_version: str | None
    processing_duration_ms: int | None
    retry_count: int
    max_retries: int
    failure_message: str | None
    confidence_score: Decimal
    status: str
    confirmed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OCRResultListRead(BaseModel):
    items: list[OCRResultRead]
    total: int
    limit: int
    offset: int
