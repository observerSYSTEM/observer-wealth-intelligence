from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.user import validate_currency, validate_timezone


class AppSettingsRead(BaseModel):
    registration_enabled: bool
    default_timezone: str
    default_currency: str
    savings_percentage: int
    business_percentage: int
    living_percentage: int
    primary_goal_amount: Decimal
    primary_goal_currency: str
    receipt_ocr_enabled: bool
    theme_preference: str

    model_config = ConfigDict(from_attributes=True)


class AppSettingsUpdate(BaseModel):
    registration_enabled: bool | None = None
    default_timezone: str | None = None
    default_currency: str | None = None
    savings_percentage: int | None = Field(default=None, ge=0, le=100)
    business_percentage: int | None = Field(default=None, ge=0, le=100)
    living_percentage: int | None = Field(default=None, ge=0, le=100)
    primary_goal_amount: Decimal | None = Field(default=None, ge=Decimal("0"))
    primary_goal_currency: str | None = None
    receipt_ocr_enabled: bool | None = None
    theme_preference: str | None = None

    @field_validator("default_timezone")
    @classmethod
    def validate_default_timezone(cls, value: str | None) -> str | None:
        return validate_timezone(value) if value is not None else value

    @field_validator("default_currency", "primary_goal_currency")
    @classmethod
    def validate_settings_currency(cls, value: str | None) -> str | None:
        return validate_currency(value) if value is not None else value

    @field_validator("theme_preference")
    @classmethod
    def validate_theme(cls, value: str | None) -> str | None:
        if value is not None and value not in {"system", "light", "dark"}:
            raise ValueError("Theme preference must be system, light, or dark")
        return value

    @model_validator(mode="after")
    def validate_allocation_total(self) -> "AppSettingsUpdate":
        values = [
            self.savings_percentage,
            self.business_percentage,
            self.living_percentage,
        ]
        if all(value is not None for value in values) and sum(
            value for value in values if value is not None
        ) != 100:
            raise ValueError("Savings, business, and living percentages must total exactly 100")
        return self
