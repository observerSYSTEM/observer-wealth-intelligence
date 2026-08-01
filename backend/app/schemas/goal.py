from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.asset import normalize_text
from app.schemas.entry import money
from app.schemas.user import validate_currency

GoalStatus = Literal["active", "paused", "completed", "cancelled", "archived"]
GoalCategory = Literal[
    "emergency_fund",
    "house",
    "land",
    "relocation",
    "business",
    "education",
    "investment",
    "family",
    "vehicle",
    "retirement",
    "other",
]
GoalProgressSource = Literal["manual", "tracked_savings", "linked_assets"]
ContributionSourceType = Literal["manual", "wealth_entry", "asset", "adjustment"]


def progress_percentage(current_amount: Decimal, target_amount: Decimal) -> Decimal:
    if target_amount <= 0:
        return Decimal("0.00")
    return money(min(Decimal("100.00"), current_amount / target_amount * Decimal("100")))


class GoalBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    currency: str = "GBP"
    target_amount: Decimal = Field(gt=Decimal("0"), max_digits=18)
    starting_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=18)
    current_amount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=18)
    deadline: date | None = None
    category: GoalCategory = "other"
    priority: int = Field(default=3, ge=1, le=5)
    progress_source: GoalProgressSource = "manual"
    status: GoalStatus = "active"
    is_primary: bool = False
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "description", "notes")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return normalize_text(value)

    @field_validator("currency")
    @classmethod
    def validate_goal_currency(cls, value: str) -> str:
        return validate_currency(value)

    @field_validator("target_amount", "starting_amount", "current_amount")
    @classmethod
    def round_amount(cls, value: Decimal) -> Decimal:
        return money(value)

    @model_validator(mode="after")
    def align_starting_current(self) -> "GoalBase":
        if self.current_amount == Decimal("0.00") and self.starting_amount > 0:
            self.current_amount = self.starting_amount
        return self


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    category: GoalCategory | None = None
    target_amount: Decimal | None = Field(default=None, gt=Decimal("0"), max_digits=18)
    deadline: date | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    progress_source: GoalProgressSource | None = None
    status: GoalStatus | None = None
    is_primary: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "description", "notes")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        return normalize_text(value)

    @field_validator("target_amount")
    @classmethod
    def round_optional_amount(cls, value: Decimal | None) -> Decimal | None:
        return money(value) if value is not None else value


class GoalContributionCreate(BaseModel):
    amount: Decimal = Field(gt=Decimal("0"), max_digits=18)
    currency: str | None = None
    contribution_date: date | None = None
    source_type: ContributionSourceType = "manual"
    source_id: str | None = Field(default=None, max_length=36)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("amount")
    @classmethod
    def round_contribution(cls, value: Decimal) -> Decimal:
        return money(value)

    @field_validator("currency")
    @classmethod
    def validate_optional_currency(cls, value: str | None) -> str | None:
        return validate_currency(value) if value is not None else value

    @field_validator("source_type", "notes")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        return normalize_text(value)


class GoalContributionUpdate(BaseModel):
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: str | None) -> str | None:
        return normalize_text(value)


class GoalContributionRead(BaseModel):
    id: str
    goal_id: str
    user_id: str
    amount: Decimal
    currency: str
    contribution_date: date
    source_type: str
    source_id: str | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoalRead(BaseModel):
    id: str
    user_id: str
    name: str
    description: str | None
    category: str
    currency: str
    target_amount: Decimal
    starting_amount: Decimal
    current_amount: Decimal
    deadline: date | None
    priority: int
    status: str
    progress_source: str
    is_primary: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    archived_at: datetime | None
    progress_percentage: Decimal = Decimal("0.00")
    remaining_amount: Decimal = Decimal("0.00")
    overfunded_amount: Decimal = Decimal("0.00")
    estimated_monthly_contribution: Decimal | None = None

    model_config = ConfigDict(from_attributes=True)


class GoalListRead(BaseModel):
    items: list[GoalRead]
    total: int
    limit: int
    offset: int


class GoalContributionListRead(BaseModel):
    items: list[GoalContributionRead]
    total: int


def estimated_monthly(target: Decimal, current: Decimal, deadline: date | None) -> Decimal | None:
    if deadline is None:
        return None
    today = datetime.now(UTC).date()
    if deadline <= today:
        return money(max(Decimal("0.00"), target - current))
    months = max(1, (deadline.year - today.year) * 12 + (deadline.month - today.month))
    return money(max(Decimal("0.00"), target - current) / Decimal(months))
