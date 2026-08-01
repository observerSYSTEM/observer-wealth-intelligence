from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wealth_entry import WealthEntry
from app.schemas.dashboard import CurrencySavingsTotal, DashboardSummaryRead
from app.services.entries import entry_to_read, quantize_money, user_today
from app.services.portfolio import portfolio_summary
from app.services.settings import get_app_settings


def goal_progress(total: Decimal, goal: Decimal) -> Decimal:
    if goal <= 0:
        return Decimal("0.00")
    return quantize_money(min(Decimal("100.00"), total / goal * Decimal("100")))


def streaks(entries: list[WealthEntry]) -> tuple[int, int]:
    eligible_by_date: dict[date, list[WealthEntry]] = defaultdict(list)
    for entry in entries:
        if entry.recommended_savings > 0:
            eligible_by_date[entry.entry_date].append(entry)

    current = 0
    longest = 0
    running = 0
    first_break_seen = False
    for entry_date in sorted(eligible_by_date.keys(), reverse=True):
        day_met = all(
            entry.status in {"target_met", "above_target"}
            for entry in eligible_by_date[entry_date]
        )
        if day_met:
            running += 1
            if not first_break_seen:
                current = running
            longest = max(longest, running)
        else:
            first_break_seen = True
            running = 0
    return current, longest


def dashboard_summary(db: Session, user: User) -> DashboardSummaryRead:
    settings = get_app_settings(db)
    entries = list(
        db.scalars(
            select(WealthEntry)
            .where(WealthEntry.user_id == user.id)
            .order_by(desc(WealthEntry.entry_date), desc(WealthEntry.created_at))
        ).all()
    )
    today = user_today(user)
    month_prefix = today.strftime("%Y-%m")
    year = today.year
    goal_currency = settings.primary_goal_currency
    matching_entries = [entry for entry in entries if entry.currency == goal_currency]
    eligible_entries = [entry for entry in matching_entries if entry.recommended_savings > 0]
    scored_entries = [entry for entry in matching_entries if entry.discipline_score is not None]
    total = quantize_money(
        sum((entry.actual_savings for entry in matching_entries), Decimal("0.00"))
    )
    this_month = quantize_money(
        sum(
            (
                entry.actual_savings
                for entry in matching_entries
                if entry.entry_date.strftime("%Y-%m") == month_prefix
            ),
            Decimal("0.00"),
        )
    )
    this_year = quantize_money(
        sum(
            (
                entry.actual_savings
                for entry in matching_entries
                if entry.entry_date.year == year
            ),
            Decimal("0.00"),
        )
    )
    today_profit = quantize_money(
        sum(
            (entry.realised_profit for entry in matching_entries if entry.entry_date == today),
            Decimal("0.00"),
        )
    )
    today_savings = quantize_money(
        sum(
            (entry.actual_savings for entry in matching_entries if entry.entry_date == today),
            Decimal("0.00"),
        )
    )
    average_savings = (
        quantize_money(
            sum((entry.actual_savings for entry in eligible_entries), Decimal("0.00"))
            / Decimal(len(eligible_entries))
        )
        if eligible_entries
        else Decimal("0.00")
    )
    average_score = (
        quantize_money(
            Decimal(sum(entry.discipline_score or 0 for entry in scored_entries))
            / Decimal(len(scored_entries))
        )
        if scored_entries
        else None
    )
    current_score = scored_entries[0].discipline_score if scored_entries else None
    current_streak, longest_streak = streaks(matching_entries)
    portfolio = portfolio_summary(db, user)

    by_currency: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    daily: dict[date, Decimal] = defaultdict(lambda: Decimal("0.00"))
    monthly: dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for entry in entries:
        by_currency[entry.currency] += entry.actual_savings
        if entry.currency == goal_currency:
            daily[entry.entry_date] += entry.actual_savings
            monthly[entry.entry_date.strftime("%Y-%m")] += entry.actual_savings

    return DashboardSummaryRead(
        tracked_savings=total,
        tracked_savings_currency=goal_currency,
        savings_this_month=this_month,
        savings_this_year=this_year,
        today_realised_profit=today_profit,
        today_actual_savings=today_savings,
        average_savings_per_eligible_entry=average_savings,
        current_discipline_score=current_score,
        average_discipline_score=average_score,
        primary_goal_amount=settings.primary_goal_amount,
        primary_goal_currency=goal_currency,
        goal_progress_percentage=goal_progress(total, settings.primary_goal_amount),
        current_streak=current_streak,
        longest_streak=longest_streak,
        latest_entries=[entry_to_read(entry, user) for entry in entries[:8]],
        savings_by_currency=[
            CurrencySavingsTotal(currency=currency, total_actual_savings=quantize_money(amount))
            for currency, amount in sorted(by_currency.items())
        ],
        daily_savings=[
            (day, quantize_money(amount)) for day, amount in sorted(daily.items())[-30:]
        ],
        monthly_savings=[
            (month, quantize_money(amount)) for month, amount in sorted(monthly.items())[-12:]
        ],
        total_assets=portfolio.total_assets,
        cash=portfolio.cash,
        investments=portfolio.investments,
        crypto=portfolio.crypto,
        property=portfolio.property,
        business=portfolio.business,
        trading_accounts=portfolio.trading_accounts,
        asset_allocation=portfolio.allocation,
        portfolio_growth=[
            (point.valuation_date, point.currency, point.total_value)
            for point in portfolio.growth
        ],
        recent_assets=portfolio.recent_assets,
        recent_receipts=portfolio.recent_receipts,
    )
