from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.models.receipt import Receipt
from app.models.user import User
from app.models.wealth_entry import WealthEntry
from app.schemas.entry import EntryCreate, EntryRead, EntryUpdate
from app.services.audit import create_audit_log
from app.services.sessions import as_utc
from app.services.settings import get_app_settings

MONEY = Decimal("0.01")


def quantize_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def calculate_percentage(amount: Decimal, percentage: int) -> Decimal:
    if amount <= 0:
        return Decimal("0.00")
    return quantize_money(amount * Decimal(percentage) / Decimal(100))


def calculate_discipline_score(
    recommended_savings: Decimal,
    actual_savings: Decimal,
) -> tuple[str, int | None]:
    if recommended_savings <= 0:
        return "no_savings_required", None
    if actual_savings >= recommended_savings:
        status_value = "above_target" if actual_savings > recommended_savings else "target_met"
        return status_value, 100
    if actual_savings >= quantize_money(recommended_savings * Decimal("0.80")):
        return "below_target", 80
    if actual_savings >= quantize_money(recommended_savings * Decimal("0.50")):
        return "below_target", 50
    if actual_savings > 0:
        return "below_target", 25
    return "below_target", 0


def user_today(user: User) -> date:
    return datetime.now(UTC).astimezone(ZoneInfo(user.timezone)).date()


def ensure_entry_date_allowed(
    entry_date: date,
    user: User,
    future_confirmed: bool,
) -> None:
    if entry_date > user_today(user) and not future_confirmed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Future-dated entries require confirmation",
        )


def ensure_receipt_available(
    db: Session,
    user: User,
    receipt_id: str | None,
    entry_id: str | None = None,
) -> None:
    if receipt_id is None:
        return
    receipt = db.get(Receipt, receipt_id)
    if receipt is None or receipt.user_id != user.id or receipt.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    linked_entry = db.scalar(
        select(WealthEntry).where(
            WealthEntry.receipt_id == receipt_id,
            WealthEntry.id != entry_id,
        )
    )
    if linked_entry is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Receipt is already attached to another entry",
        )


def ensure_duplicate_confirmed(
    db: Session,
    user: User,
    entry_date: date,
    income_source: str,
    duplicate_confirmed: bool,
    entry_id: str | None = None,
) -> None:
    if income_source != "forex" or duplicate_confirmed:
        return
    existing = db.scalar(
        select(WealthEntry).where(
            WealthEntry.user_id == user.id,
            WealthEntry.entry_date == entry_date,
            WealthEntry.income_source == "forex",
            WealthEntry.id != entry_id,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A forex entry already exists for this date. Confirm duplicate to continue.",
        )


def apply_entry_calculation(
    entry: WealthEntry,
    savings_percentage: int,
    business_percentage: int,
    living_percentage: int,
) -> None:
    entry.savings_percentage = savings_percentage
    entry.business_percentage = business_percentage
    entry.living_percentage = living_percentage
    entry.realised_profit = quantize_money(entry.realised_profit)
    entry.actual_savings = quantize_money(entry.actual_savings)
    entry.actual_business = quantize_money(entry.actual_business)
    entry.actual_living = quantize_money(entry.actual_living)
    entry.recommended_savings = calculate_percentage(entry.realised_profit, savings_percentage)
    entry.recommended_business = calculate_percentage(entry.realised_profit, business_percentage)
    entry.recommended_living = calculate_percentage(entry.realised_profit, living_percentage)
    entry.savings_variance = quantize_money(entry.actual_savings - entry.recommended_savings)
    entry.status, entry.discipline_score = calculate_discipline_score(
        entry.recommended_savings,
        entry.actual_savings,
    )


def create_entry(
    db: Session,
    user: User,
    payload: EntryCreate,
    request: Request | None = None,
) -> WealthEntry:
    existing = db.scalar(
        select(WealthEntry).where(
            WealthEntry.user_id == user.id,
            WealthEntry.idempotency_key == payload.idempotency_key,
        )
    )
    if existing is not None:
        return existing

    settings = get_app_settings(db)
    entry_date = payload.entry_date or user_today(user)
    ensure_entry_date_allowed(entry_date, user, payload.future_confirmed)
    ensure_duplicate_confirmed(
        db,
        user,
        entry_date,
        payload.income_source,
        payload.duplicate_confirmed,
    )
    ensure_receipt_available(db, user, payload.receipt_id)

    now = datetime.now(UTC)
    entry = WealthEntry(
        user_id=user.id,
        entry_date=entry_date,
        recorded_at=now,
        timezone=user.timezone,
        income_source=payload.income_source,
        realised_profit=payload.realised_profit,
        currency=payload.currency,
        actual_savings=payload.actual_savings,
        actual_business=payload.actual_business,
        actual_living=payload.actual_living,
        notes=payload.notes,
        transfer_confirmed=payload.transfer_confirmed,
        receipt_id=payload.receipt_id,
        idempotency_key=payload.idempotency_key,
    )
    apply_entry_calculation(
        entry,
        settings.savings_percentage,
        settings.business_percentage,
        settings.living_percentage,
    )
    db.add(entry)
    db.flush()
    create_audit_log(db, "entry_create", user.id, request, {"entry_id": entry.id})
    db.commit()
    db.refresh(entry)
    return entry


def get_user_entry(db: Session, user: User, entry_id: str) -> WealthEntry:
    entry = db.get(WealthEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return entry


def update_entry(
    db: Session,
    user: User,
    entry: WealthEntry,
    payload: EntryUpdate,
    request: Request | None = None,
) -> WealthEntry:
    changes = payload.model_dump(exclude_unset=True)
    changes.pop("duplicate_confirmed", None)
    changes.pop("future_confirmed", None)

    next_date = changes.get("entry_date", entry.entry_date)
    next_source = changes.get("income_source", entry.income_source)
    ensure_entry_date_allowed(next_date, user, payload.future_confirmed)
    ensure_duplicate_confirmed(
        db,
        user,
        next_date,
        next_source,
        payload.duplicate_confirmed,
        entry_id=entry.id,
    )
    if "receipt_id" in changes:
        ensure_receipt_available(db, user, changes["receipt_id"], entry.id)

    for key, value in changes.items():
        setattr(entry, key, value)

    apply_entry_calculation(
        entry,
        entry.savings_percentage,
        entry.business_percentage,
        entry.living_percentage,
    )
    create_audit_log(db, "entry_update", user.id, request, {"entry_id": entry.id})
    db.commit()
    db.refresh(entry)
    return entry


def delete_entry(
    db: Session,
    user: User,
    entry: WealthEntry,
    request: Request | None = None,
) -> None:
    entry_id = entry.id
    db.delete(entry)
    create_audit_log(db, "entry_delete", user.id, request, {"entry_id": entry_id})
    db.commit()


def entry_recorded_at_local(entry: WealthEntry, user: User) -> str:
    return as_utc(entry.recorded_at).astimezone(ZoneInfo(user.timezone)).isoformat()


def entry_to_read(entry: WealthEntry, user: User) -> EntryRead:
    return EntryRead.model_validate(
        entry,
        from_attributes=True,
        context={},
    ).model_copy(update={"recorded_at_local": entry_recorded_at_local(entry, user)})


def list_entries(
    db: Session,
    user: User,
    start_date: date | None,
    end_date: date | None,
    income_source: str | None,
    currency: str | None,
    limit: int,
    offset: int,
) -> tuple[list[WealthEntry], int]:
    filters = [WealthEntry.user_id == user.id]
    if start_date is not None:
        filters.append(WealthEntry.entry_date >= start_date)
    if end_date is not None:
        filters.append(WealthEntry.entry_date <= end_date)
    if income_source is not None:
        filters.append(WealthEntry.income_source == income_source)
    if currency is not None:
        filters.append(WealthEntry.currency == currency)

    total = db.scalar(select(func.count()).select_from(WealthEntry).where(and_(*filters))) or 0
    items = db.scalars(
        select(WealthEntry)
        .where(and_(*filters))
        .order_by(desc(WealthEntry.entry_date), desc(WealthEntry.created_at))
        .limit(limit)
        .offset(offset)
    ).all()
    return list(items), total
