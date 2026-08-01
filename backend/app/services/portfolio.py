from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.asset_history import AssetValueHistory
from app.models.receipt import Receipt
from app.models.user import User
from app.models.wealth_entry import WealthEntry
from app.schemas.portfolio import (
    CategoryValueRead,
    CurrencyValueRead,
    PortfolioGrowthPointRead,
    PortfolioSummaryRead,
)
from app.services.assets import asset_to_read
from app.services.entries import quantize_money
from app.services.receipts import receipt_to_read
from app.services.settings import get_app_settings

PORTFOLIO_CATEGORIES = [
    "cash",
    "investment",
    "crypto",
    "property",
    "business",
    "trading_account",
]


def goal_progress(total: Decimal, goal: Decimal) -> Decimal:
    if goal <= 0:
        return Decimal("0.00")
    return quantize_money(min(Decimal("100.00"), total / goal * Decimal("100")))


def active_assets(db: Session, user: User) -> list[Asset]:
    return list(
        db.scalars(
            select(Asset)
            .where(Asset.user_id == user.id, Asset.status == "active")
            .order_by(desc(Asset.updated_at), desc(Asset.created_at))
        ).all()
    )


def tracked_savings_by_currency(db: Session, user: User) -> dict[str, Decimal]:
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    entries = db.scalars(select(WealthEntry).where(WealthEntry.user_id == user.id)).all()
    for entry in entries:
        totals[entry.currency] += entry.actual_savings
    return totals


def category_totals(
    assets: list[Asset],
    tracked_savings: Decimal,
    primary_currency: str,
) -> dict[str, Decimal]:
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for asset in assets:
        if asset.currency == primary_currency:
            totals[asset.category] += asset.current_value
    totals["cash"] += tracked_savings
    return totals


def allocation_rows(totals: dict[str, Decimal]) -> list[CategoryValueRead]:
    total = sum((totals[category] for category in PORTFOLIO_CATEGORIES), Decimal("0.00"))
    rows: list[CategoryValueRead] = []
    for category in PORTFOLIO_CATEGORIES:
        value = quantize_money(totals[category])
        percentage = (
            quantize_money(value / total * Decimal("100"))
            if total > 0
            else Decimal("0.00")
        )
        rows.append(
            CategoryValueRead(
                category=category,
                currency="",
                total_value=value,
                allocation_percentage=percentage,
            )
        )
    return rows


def growth_points(db: Session, user: User, primary_currency: str) -> list[PortfolioGrowthPointRead]:
    histories = list(
        db.scalars(
            select(AssetValueHistory)
            .where(
                AssetValueHistory.user_id == user.id,
                AssetValueHistory.currency == primary_currency,
            )
            .order_by(AssetValueHistory.valuation_date, AssetValueHistory.recorded_at)
        ).all()
    )
    values_by_asset: dict[str, Decimal] = {}
    totals_by_date: dict[date, Decimal] = {}
    for history in histories:
        values_by_asset[history.asset_id] = history.new_value
        totals_by_date[history.valuation_date] = sum(values_by_asset.values(), Decimal("0.00"))
    return [
        PortfolioGrowthPointRead(
            valuation_date=valuation_date,
            currency=primary_currency,
            total_value=quantize_money(total),
        )
        for valuation_date, total in sorted(totals_by_date.items())[-24:]
    ]


def portfolio_summary(db: Session, user: User) -> PortfolioSummaryRead:
    settings = get_app_settings(db)
    primary_currency = settings.primary_goal_currency
    assets = active_assets(db, user)
    savings_by_currency = tracked_savings_by_currency(db, user)
    tracked_savings = quantize_money(savings_by_currency.get(primary_currency, Decimal("0.00")))
    totals = category_totals(assets, tracked_savings, primary_currency)
    asset_value = quantize_money(
        sum(
            (asset.current_value for asset in assets if asset.currency == primary_currency),
            Decimal("0.00"),
        )
    )
    total_assets = quantize_money(asset_value + tracked_savings)

    currency_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for asset in assets:
        currency_totals[asset.currency] += asset.current_value
    for currency, value in savings_by_currency.items():
        currency_totals[currency] += value

    allocation = allocation_rows(totals)
    allocation = [
        row.model_copy(update={"currency": primary_currency})
        for row in allocation
    ]
    recent_receipts = list(
        db.scalars(
            select(Receipt)
            .where(Receipt.user_id == user.id, Receipt.deleted_at.is_(None))
            .order_by(desc(Receipt.uploaded_at))
            .limit(6)
        ).all()
    )

    return PortfolioSummaryRead(
        primary_currency=primary_currency,
        total_assets=total_assets,
        tracked_savings=tracked_savings,
        cash=quantize_money(totals["cash"]),
        investments=quantize_money(totals["investment"]),
        crypto=quantize_money(totals["crypto"]),
        property=quantize_money(totals["property"]),
        business=quantize_money(totals["business"]),
        trading_accounts=quantize_money(totals["trading_account"]),
        goal_progress_percentage=goal_progress(total_assets, settings.primary_goal_amount),
        allocation=allocation,
        totals_by_currency=[
            CurrencyValueRead(currency=currency, total_value=quantize_money(value))
            for currency, value in sorted(currency_totals.items())
        ],
        growth=growth_points(db, user, primary_currency),
        recent_assets=[asset_to_read(db, asset) for asset in assets[:6]],
        recent_receipts=[receipt_to_read(db, receipt) for receipt in recent_receipts],
    )
