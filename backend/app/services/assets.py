from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.asset_history import AssetValueHistory
from app.models.user import User
from app.models.vault_document import VaultDocument
from app.schemas.asset import (
    AssetCreate,
    AssetHistoryListRead,
    AssetListRead,
    AssetRead,
    AssetUpdate,
    AssetValueHistoryCreate,
    AssetValueHistoryRead,
)
from app.services.audit import create_audit_log
from app.services.entries import quantize_money, user_today


def get_user_asset(db: Session, user: User, asset_id: str) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None or asset.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


def document_count(db: Session, asset_id: str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(VaultDocument)
            .where(VaultDocument.asset_id == asset_id, VaultDocument.deleted_at.is_(None))
        )
        or 0
    )


def asset_to_read(db: Session, asset: Asset) -> AssetRead:
    return AssetRead.model_validate(asset, from_attributes=True).model_copy(
        update={"document_count": document_count(db, asset.id)}
    )


def append_asset_history(
    db: Session,
    user: User,
    asset: Asset,
    new_value: Decimal,
    valuation_date: date,
    source: str,
    notes: str | None = None,
    previous_value: Decimal | None = None,
) -> AssetValueHistory:
    history = AssetValueHistory(
        asset_id=asset.id,
        user_id=user.id,
        previous_value=asset.current_value if previous_value is None else previous_value,
        new_value=quantize_money(new_value),
        currency=asset.currency,
        valuation_date=valuation_date,
        source=source,
        notes=notes,
        recorded_at=datetime.now(UTC),
    )
    db.add(history)
    return history


def create_asset(
    db: Session,
    user: User,
    payload: AssetCreate,
    request: Request | None = None,
) -> Asset:
    asset = Asset(user_id=user.id, **payload.model_dump())
    db.add(asset)
    db.flush()
    history = AssetValueHistory(
        asset_id=asset.id,
        user_id=user.id,
        previous_value=None,
        new_value=asset.current_value,
        currency=asset.currency,
        valuation_date=payload.purchase_date or user_today(user),
        source="create",
        notes=None,
        recorded_at=datetime.now(UTC),
    )
    db.add(history)
    create_audit_log(db, "asset_create", user.id, request, {"asset_id": asset.id})
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(
    db: Session,
    user: User,
    asset: Asset,
    payload: AssetUpdate,
    request: Request | None = None,
) -> Asset:
    changes = payload.model_dump(exclude_unset=True)
    history_notes = changes.pop("history_notes", None)
    value_changed = "current_value" in changes and changes["current_value"] != asset.current_value
    previous_value = asset.current_value

    if "currency" in changes and changes["currency"] != asset.currency:
        existing_history = db.scalar(
            select(AssetValueHistory.id).where(AssetValueHistory.asset_id == asset.id).limit(1)
        )
        if existing_history is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Asset currency cannot be changed after value history exists",
            )

    new_value = changes.get("current_value", asset.current_value)
    for key, value in changes.items():
        setattr(asset, key, value)

    if value_changed:
        append_asset_history(
            db=db,
            user=user,
            asset=asset,
            new_value=new_value,
            valuation_date=user_today(user),
            source="manual_update",
            notes=history_notes,
            previous_value=previous_value,
        )
    create_audit_log(db, "asset_update", user.id, request, {"asset_id": asset.id})
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset(
    db: Session,
    user: User,
    asset: Asset,
    request: Request | None = None,
) -> None:
    asset.status = "archived"
    create_audit_log(db, "asset_archive", user.id, request, {"asset_id": asset.id})
    db.commit()


def add_value_history(
    db: Session,
    user: User,
    asset: Asset,
    payload: AssetValueHistoryCreate,
    request: Request | None = None,
) -> AssetValueHistory:
    history = append_asset_history(
        db=db,
        user=user,
        asset=asset,
        new_value=payload.new_value,
        valuation_date=payload.valuation_date or user_today(user),
        source="manual_update",
        notes=payload.notes,
    )
    asset.current_value = payload.new_value
    create_audit_log(db, "asset_value_update", user.id, request, {"asset_id": asset.id})
    db.commit()
    db.refresh(history)
    return history


def list_asset_history(db: Session, user: User, asset: Asset) -> AssetHistoryListRead:
    items = list(
        db.scalars(
            select(AssetValueHistory)
            .where(AssetValueHistory.user_id == user.id, AssetValueHistory.asset_id == asset.id)
            .order_by(desc(AssetValueHistory.valuation_date), desc(AssetValueHistory.recorded_at))
        ).all()
    )
    return AssetHistoryListRead(
        items=[AssetValueHistoryRead.model_validate(item, from_attributes=True) for item in items],
        total=len(items),
    )


def list_assets(
    db: Session,
    user: User,
    category: str | None,
    status_filter: str | None,
    search: str | None,
    limit: int,
    offset: int,
) -> AssetListRead:
    filters = [Asset.user_id == user.id]
    if category is not None:
        filters.append(Asset.category == category)
    if status_filter is not None:
        filters.append(Asset.status == status_filter)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                Asset.asset_name.ilike(pattern),
                Asset.institution.ilike(pattern),
                Asset.reference.ilike(pattern),
                Asset.notes.ilike(pattern),
            )
        )
    total = db.scalar(select(func.count()).select_from(Asset).where(and_(*filters))) or 0
    items = list(
        db.scalars(
            select(Asset)
            .where(and_(*filters))
            .order_by(desc(Asset.updated_at), desc(Asset.created_at))
            .limit(limit)
            .offset(offset)
        ).all()
    )
    return AssetListRead(
        items=[asset_to_read(db, asset) for asset in items],
        total=total,
        limit=limit,
        offset=offset,
    )
