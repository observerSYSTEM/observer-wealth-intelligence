from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.asset import AssetRead
from app.schemas.receipt import ReceiptRead


class CategoryValueRead(BaseModel):
    category: str
    currency: str
    total_value: Decimal
    allocation_percentage: Decimal


class CurrencyValueRead(BaseModel):
    currency: str
    total_value: Decimal


class PortfolioGrowthPointRead(BaseModel):
    valuation_date: date
    currency: str
    total_value: Decimal


class PortfolioSummaryRead(BaseModel):
    primary_currency: str
    total_assets: Decimal
    tracked_savings: Decimal
    cash: Decimal
    investments: Decimal
    crypto: Decimal
    property: Decimal
    business: Decimal
    trading_accounts: Decimal
    goal_progress_percentage: Decimal
    allocation: list[CategoryValueRead]
    totals_by_currency: list[CurrencyValueRead]
    growth: list[PortfolioGrowthPointRead]
    recent_assets: list[AssetRead]
    recent_receipts: list[ReceiptRead]
