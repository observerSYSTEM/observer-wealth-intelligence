from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.asset_history import AssetValueHistory
from app.models.backup_run import BackupRun
from app.models.financial_goal import FinancialGoal
from app.models.goal_contribution import GoalContribution
from app.models.notification import Notification
from app.models.ocr_result import OCRResult
from app.models.receipt import Receipt
from app.models.timeline_event import TimelineEvent
from app.models.user import User
from app.models.vault_document import VaultDocument
from app.models.wealth_entry import WealthEntry
from app.schemas.timeline import TimelineEventRead, TimelineListRead


def event(
    *,
    user: User,
    event_id: str,
    event_type: str,
    title: str,
    occurred_at: datetime,
    entity_type: str,
    entity_id: str,
    summary: str | None = None,
    amount: Decimal | None = None,
    currency: str | None = None,
    status: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> TimelineEventRead:
    return TimelineEventRead(
        id=f"{event_type}:{event_id}",
        user_id=user.id,
        event_type=event_type,
        title=title,
        summary=summary,
        occurred_at=occurred_at,
        amount=amount,
        currency=currency,
        entity_type=entity_type,
        entity_id=entity_id,
        status=status,
        metadata=metadata or {},
        created_at=occurred_at,
    )


def create_timeline_event(
    db: Session,
    user: User,
    *,
    event_type: str,
    occurred_at: datetime,
    title: str,
    entity_type: str,
    entity_id: str,
    summary: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> TimelineEvent:
    row = TimelineEvent(
        user_id=user.id,
        event_type=event_type,
        occurred_at=occurred_at,
        title=title,
        summary=summary,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=metadata or {},
    )
    db.add(row)
    return row


def stored_event_to_read(row: TimelineEvent) -> TimelineEventRead:
    return TimelineEventRead(
        id=row.id,
        user_id=row.user_id,
        event_type=row.event_type,
        title=row.title,
        summary=row.summary,
        occurred_at=row.occurred_at,
        amount=None,
        currency=None,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        status=None,
        metadata=row.metadata_json,
        created_at=row.created_at,
    )


def aggregated_events(db: Session, user: User) -> list[TimelineEventRead]:
    rows: list[TimelineEventRead] = []

    for entry in db.scalars(select(WealthEntry).where(WealthEntry.user_id == user.id)).all():
        rows.append(
            event(
                user=user,
                event_id=entry.id,
                event_type="wealth_entry_created",
                title="Wealth entry recorded",
                summary=None,
                occurred_at=entry.recorded_at,
                amount=entry.actual_savings,
                currency=entry.currency,
                entity_type="wealth_entry",
                entity_id=entry.id,
                status=entry.status,
                metadata={"income_source": entry.income_source},
            )
        )
        if entry.status == "above_target":
            rows.append(
                event(
                    user=user,
                    event_id=f"{entry.id}:target_exceeded",
                    event_type="savings_target_exceeded",
                    title="Savings target exceeded",
                    occurred_at=entry.recorded_at,
                    amount=entry.savings_variance,
                    currency=entry.currency,
                    entity_type="wealth_entry",
                    entity_id=entry.id,
                    status=entry.status,
                )
            )

    for receipt in db.scalars(select(Receipt).where(Receipt.user_id == user.id)).all():
        if receipt.deleted_at is None:
            rows.append(
                event(
                    user=user,
                    event_id=receipt.id,
                    event_type="receipt_uploaded",
                    title=f"Receipt uploaded: {receipt.original_filename}",
                    occurred_at=receipt.uploaded_at,
                    entity_type="receipt",
                    entity_id=receipt.id,
                    status=receipt.media_type,
                    metadata={"file_size": receipt.file_size},
                )
            )

    for asset in db.scalars(select(Asset).where(Asset.user_id == user.id)).all():
        rows.append(
            event(
                user=user,
                event_id=asset.id,
                event_type="asset_created",
                title=f"Asset added: {asset.asset_name}",
                occurred_at=asset.created_at,
                amount=asset.current_value,
                currency=asset.currency,
                entity_type="asset",
                entity_id=asset.id,
                status=asset.status,
                metadata={"category": asset.category},
            )
        )

    history_query = select(AssetValueHistory).where(AssetValueHistory.user_id == user.id)
    for history in db.scalars(history_query).all():
        rows.append(
            event(
                user=user,
                event_id=history.id,
                event_type="asset_value_updated",
                title="Asset value updated",
                occurred_at=history.recorded_at,
                amount=history.new_value,
                currency=history.currency,
                entity_type="asset",
                entity_id=history.asset_id,
                status=history.source,
            )
        )

    for document in db.scalars(select(VaultDocument).where(VaultDocument.user_id == user.id)).all():
        if document.deleted_at is None:
            rows.append(
                event(
                    user=user,
                    event_id=document.id,
                    event_type=(
                        "asset_document_uploaded"
                        if document.storage_area == "asset"
                        else "vault_document_uploaded"
                    ),
                    title=f"Document uploaded: {document.original_filename}",
                    occurred_at=document.uploaded_at,
                    entity_type="vault_document",
                    entity_id=document.id,
                    status=document.folder,
                    metadata={"storage_area": document.storage_area},
                )
            )

    for goal in db.scalars(select(FinancialGoal).where(FinancialGoal.user_id == user.id)).all():
        rows.append(
            event(
                user=user,
                event_id=goal.id,
                event_type="goal_created",
                title=f"Goal created: {goal.name}",
                occurred_at=goal.created_at,
                amount=goal.target_amount,
                currency=goal.currency,
                entity_type="goal",
                entity_id=goal.id,
                status=goal.status,
                metadata={"category": goal.category},
            )
        )
        if goal.completed_at is not None:
            rows.append(
                event(
                    user=user,
                    event_id=f"{goal.id}:completed",
                    event_type="goal_completed",
                    title=f"Goal completed: {goal.name}",
                    occurred_at=goal.completed_at,
                    amount=goal.target_amount,
                    currency=goal.currency,
                    entity_type="goal",
                    entity_id=goal.id,
                    status=goal.status,
                )
            )

    contribution_query = select(GoalContribution).where(GoalContribution.user_id == user.id)
    for contribution in db.scalars(contribution_query).all():
        rows.append(
            event(
                user=user,
                event_id=contribution.id,
                event_type="goal_contribution_added",
                title="Goal contribution added",
                occurred_at=contribution.created_at,
                amount=contribution.amount,
                currency=contribution.currency,
                entity_type="goal",
                entity_id=contribution.goal_id,
                status=contribution.source_type,
            )
        )

    for ocr_result in db.scalars(select(OCRResult).where(OCRResult.user_id == user.id)).all():
        if ocr_result.status == "confirmed":
            rows.append(
                event(
                    user=user,
                    event_id=ocr_result.id,
                    event_type="ocr_confirmed",
                    title="OCR result confirmed",
                    occurred_at=ocr_result.confirmed_at or ocr_result.updated_at,
                    amount=ocr_result.amount,
                    currency=ocr_result.currency,
                    entity_type=ocr_result.source_type,
                    entity_id=ocr_result.source_id,
                    status=ocr_result.status,
                    metadata={"confidence_score": str(ocr_result.confidence_score)},
                )
            )

    notification_query = select(Notification).where(Notification.user_id == user.id)
    for notification in db.scalars(notification_query).all():
        rows.append(
            event(
                user=user,
                event_id=notification.id,
                event_type="notification_sent",
                title=notification.title,
                summary=None,
                occurred_at=notification.created_at,
                entity_type=notification.related_type or "notification",
                entity_id=notification.related_id or notification.id,
                status=notification.status,
                metadata={"type": notification.type, "channel": notification.channel},
            )
        )

    for backup in db.scalars(select(BackupRun).where(BackupRun.user_id == user.id)).all():
        rows.append(
            event(
                user=user,
                event_id=backup.id,
                event_type="backup_completed" if backup.status == "completed" else "backup_failed",
                title="Backup completed" if backup.status == "completed" else "Backup failed",
                summary=backup.verification_message or backup.error_message,
                occurred_at=backup.completed_at or backup.started_at,
                entity_type="backup_run",
                entity_id=backup.id,
                status=backup.status,
                metadata={"restore_verified": backup.restore_verified},
            )
        )

    stored = db.scalars(select(TimelineEvent).where(TimelineEvent.user_id == user.id)).all()
    rows.extend(stored_event_to_read(row) for row in stored)
    return rows


def timeline_events(
    db: Session,
    user: User,
    limit: int,
    offset: int,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    event_type: str | None = None,
    entity_type: str | None = None,
    sort: str = "desc",
) -> TimelineListRead:
    rows = aggregated_events(db, user)
    if start_at is not None:
        rows = [row for row in rows if row.occurred_at >= start_at]
    if end_at is not None:
        rows = [row for row in rows if row.occurred_at <= end_at]
    if event_type is not None:
        rows = [row for row in rows if row.event_type == event_type]
    if entity_type is not None:
        rows = [row for row in rows if row.entity_type == entity_type]
    reverse = sort != "asc"
    ordered = sorted(rows, key=lambda row: row.occurred_at, reverse=reverse)
    return TimelineListRead(
        items=ordered[offset : offset + limit],
        total=len(ordered),
        limit=limit,
        offset=offset,
    )
