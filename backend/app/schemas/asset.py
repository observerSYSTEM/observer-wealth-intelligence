from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.entry import money
from app.schemas.user import validate_currency

AssetCategory = Literal[
    "cash",
    "investment",
    "crypto",
    "property",
    "business",
    "trading_account",
    "vehicle",
    "other",
]
AssetStatus = Literal["active", "sold", "closed", "archived"]


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return value
    normalized = " ".join(value.replace("\x00", "").split())
    return normalized or None


class AssetBase(BaseModel):
    category: AssetCategory
    asset_name: str = Field(min_length=1, max_length=160)
    currency: str = "GBP"
    purchase_price: Decimal = Field(ge=Decimal("0"), max_digits=18)
    current_value: Decimal = Field(ge=Decimal("0"), max_digits=18)
    exchange_rate_to_primary: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=18)
    purchase_date: date | None = None
    institution: str | None = Field(default=None, max_length=160)
    reference: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    status: AssetStatus = "active"

    @field_validator("asset_name", "institution", "reference", "notes")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return normalize_text(value)

    @field_validator("currency")
    @classmethod
    def validate_asset_currency(cls, value: str) -> str:
        return validate_currency(value)

    @field_validator("purchase_price", "current_value")
    @classmethod
    def round_money(cls, value: Decimal) -> Decimal:
        return money(value)


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    category: AssetCategory | None = None
    asset_name: str | None = Field(default=None, min_length=1, max_length=160)
    currency: str | None = None
    purchase_price: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=18)
    current_value: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=18)
    exchange_rate_to_primary: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=18)
    purchase_date: date | None = None
    institution: str | None = Field(default=None, max_length=160)
    reference: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    status: AssetStatus | None = None
    history_notes: str | None = Field(default=None, max_length=1000)

    @field_validator("asset_name", "institution", "reference", "notes", "history_notes")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        return normalize_text(value)

    @field_validator("currency")
    @classmethod
    def validate_optional_currency(cls, value: str | None) -> str | None:
        return validate_currency(value) if value is not None else value

    @field_validator("purchase_price", "current_value")
    @classmethod
    def round_optional_money(cls, value: Decimal | None) -> Decimal | None:
        return money(value) if value is not None else value


class AssetRead(BaseModel):
    id: str
    user_id: str
    category: str
    asset_name: str
    currency: str
    purchase_price: Decimal
    current_value: Decimal
    exchange_rate_to_primary: Decimal | None
    purchase_date: date | None
    institution: str | None
    reference: str | None
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    document_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class AssetListRead(BaseModel):
    items: list[AssetRead]
    total: int
    limit: int
    offset: int


class AssetValueHistoryCreate(BaseModel):
    new_value: Decimal = Field(ge=Decimal("0"), max_digits=18)
    valuation_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("new_value")
    @classmethod
    def round_new_value(cls, value: Decimal) -> Decimal:
        return money(value)

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: str | None) -> str | None:
        return normalize_text(value)


class AssetValueHistoryRead(BaseModel):
    id: str
    asset_id: str
    user_id: str
    previous_value: Decimal | None
    new_value: Decimal
    currency: str
    valuation_date: date
    source: str
    notes: str | None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssetHistoryListRead(BaseModel):
    items: list[AssetValueHistoryRead]
    total: int
