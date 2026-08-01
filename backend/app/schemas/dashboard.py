from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.asset import AssetRead
from app.schemas.entry import EntryRead
from app.schemas.portfolio import CategoryValueRead
from app.schemas.receipt import ReceiptRead


class CurrencySavingsTotal(BaseModel):
    currency: str
    total_actual_savings: Decimal


class DashboardSummaryRead(BaseModel):
    tracked_savings: Decimal
    tracked_savings_currency: str
    savings_this_month: Decimal
    savings_this_year: Decimal
    today_realised_profit: Decimal
    today_actual_savings: Decimal
    average_savings_per_eligible_entry: Decimal
    current_discipline_score: int | None
    average_discipline_score: Decimal | None
    primary_goal_amount: Decimal
    primary_goal_currency: str
    goal_progress_percentage: Decimal
    current_streak: int
    longest_streak: int
    latest_entries: list[EntryRead]
    savings_by_currency: list[CurrencySavingsTotal]
    daily_savings: list[tuple[date, Decimal]]
    monthly_savings: list[tuple[str, Decimal]]
    total_assets: Decimal
    cash: Decimal
    investments: Decimal
    crypto: Decimal
    property: Decimal
    business: Decimal
    trading_accounts: Decimal
    asset_allocation: list[CategoryValueRead]
    portfolio_growth: list[tuple[date, str, Decimal]]
    recent_assets: list[AssetRead]
    recent_receipts: list[ReceiptRead]
