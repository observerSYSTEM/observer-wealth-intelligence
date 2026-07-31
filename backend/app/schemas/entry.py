from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.user import validate_currency

IncomeSource = Literal["forex", "business", "employment", "other"]
EntryStatus = Literal["above_target", "target_met", "below_target", "no_savings_required"]


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class EntryBase(BaseModel):
    entry_date: date | None = None
    income_source: IncomeSource = "forex"
    realised_profit: Decimal = Field(max_digits=18)
    currency: str = "GBP"
    actual_savings: Decimal = Field(default=Decimal("0.00"), max_digits=18)
    actual_business: Decimal = Field(default=Decimal("0.00"), max_digits=18)
    actual_living: Decimal = Field(default=Decimal("0.00"), max_digits=18)
    transfer_confirmed: bool = False
    notes: str | None = Field(default=None, max_length=2000)
    receipt_id: str | None = None

    @field_validator("currency")
    @classmethod
    def validate_entry_currency(cls, value: str) -> str:
        return validate_currency(value)

    @field_validator("realised_profit", "actual_savings", "actual_business", "actual_living")
    @classmethod
    def round_money(cls, value: Decimal) -> Decimal:
        return money(value)

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = " ".join(value.replace("\x00", "").split())
        return normalized or None


class EntryCreate(EntryBase):
    duplicate_confirmed: bool = False
    future_confirmed: bool = False
    idempotency_key: str = Field(min_length=1, max_length=80)


class EntryUpdate(BaseModel):
    entry_date: date | None = None
    income_source: IncomeSource | None = None
    realised_profit: Decimal | None = Field(default=None, max_digits=18)
    currency: str | None = None
    actual_savings: Decimal | None = Field(default=None, max_digits=18)
    actual_business: Decimal | None = Field(default=None, max_digits=18)
    actual_living: Decimal | None = Field(default=None, max_digits=18)
    transfer_confirmed: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)
    receipt_id: str | None = None
    duplicate_confirmed: bool = False
    future_confirmed: bool = False

    @field_validator("currency")
    @classmethod
    def validate_optional_currency(cls, value: str | None) -> str | None:
        return validate_currency(value) if value is not None else value

    @field_validator("realised_profit", "actual_savings", "actual_business", "actual_living")
    @classmethod
    def round_optional_money(cls, value: Decimal | None) -> Decimal | None:
        return money(value) if value is not None else value

    @field_validator("notes")
    @classmethod
    def normalize_optional_notes(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = " ".join(value.replace("\x00", "").split())
        return normalized or None


class EntryRead(BaseModel):
    id: str
    user_id: str
    entry_date: date
    recorded_at: datetime
    recorded_at_local: str = ""
    timezone: str
    income_source: str
    realised_profit: Decimal
    currency: str
    savings_percentage: int
    business_percentage: int
    living_percentage: int
    recommended_savings: Decimal
    recommended_business: Decimal
    recommended_living: Decimal
    actual_savings: Decimal
    actual_business: Decimal
    actual_living: Decimal
    savings_variance: Decimal
    discipline_score: int | None
    status: EntryStatus
    notes: str | None
    transfer_confirmed: bool
    receipt_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EntryListRead(BaseModel):
    items: list[EntryRead]
    total: int
    limit: int
    offset: int
    duplicate_warning: bool = False
