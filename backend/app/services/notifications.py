from datetime import UTC, date, datetime, time
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest
from urllib.request import urlopen
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, desc, func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.user import User
from app.models.wealth_entry import WealthEntry
from app.schemas.notification import (
    NotificationCreate,
    NotificationListRead,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    NotificationRead,
    NotificationSeverity,
    NotificationType,
)
from app.services.audit import create_audit_log
from app.services.entries import user_today

telegram_test_limiter: dict[str, datetime] = {}


def notification_to_read(notification: Notification) -> NotificationRead:
    return NotificationRead.model_validate(notification, from_attributes=True)


def preference_to_read(preference: NotificationPreference) -> NotificationPreferenceRead:
    return NotificationPreferenceRead.model_validate(preference, from_attributes=True)


def get_notification_preferences(db: Session, user: User) -> NotificationPreference:
    preference = db.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    if preference is not None:
        return preference
    preference = NotificationPreference(user_id=user.id, timezone=user.timezone)
    db.add(preference)
    db.flush()
    return preference


def create_notification(
    db: Session,
    user: User,
    payload: NotificationCreate,
    request: Request | None = None,
    commit: bool = True,
) -> Notification:
    if payload.deduplication_key is not None:
        existing = db.scalar(
            select(Notification).where(
                Notification.user_id == user.id,
                Notification.deduplication_key == payload.deduplication_key,
            )
        )
        if existing is not None:
            return existing
    data = payload.model_dump()
    data["status"] = "pending" if payload.scheduled_for is not None else "sent"
    notification = Notification(user_id=user.id, **data)
    db.add(notification)
    db.flush()
    create_audit_log(
        db,
        "notification_create",
        user.id,
        request,
        {"notification_id": notification.id, "type": notification.type},
    )
    if commit:
        db.commit()
        db.refresh(notification)
    return notification


def send_telegram_message(text: str) -> tuple[str, str | None]:
    if not settings.telegram_notifications_enabled:
        return "skipped", "Telegram notifications are disabled"
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return "skipped", "Telegram bot token or chat ID is not configured"

    encoded = urlencode({"chat_id": settings.telegram_chat_id, "text": text})
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    request = UrlRequest(
        url,
        data=encoded.encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:
            if response.status >= 400:
                return "failed", f"Telegram returned HTTP {response.status}"
    except OSError as exc:
        return "failed", str(exc)
    return "sent", None


def notify_user(
    db: Session,
    user: User,
    title: str,
    message: str,
    notification_type: NotificationType,
    severity: NotificationSeverity = "info",
    related_type: str | None = None,
    related_id: str | None = None,
    deduplication_key: str | None = None,
    request: Request | None = None,
) -> list[Notification]:
    preference = get_notification_preferences(db, user)
    in_app = create_notification(
        db,
        user,
        NotificationCreate(
            title=title,
            message=message,
            type=notification_type,
            channel="in_app",
            severity=severity,
            related_type=related_type,
            related_id=related_id,
            deduplication_key=deduplication_key,
        ),
        request,
        commit=False,
    )
    notifications = [in_app]
    if settings.telegram_notifications_enabled and preference.telegram_enabled:
        telegram_status, error = send_telegram_message(f"{title}\n\n{message}")
        stored_status = telegram_status if telegram_status in {"sent", "failed"} else "cancelled"
        telegram = Notification(
            user_id=user.id,
            title=title,
            message=message,
            type=notification_type,
            channel="telegram",
            severity=severity,
            status=stored_status,
            related_type=related_type,
            related_id=related_id,
            sent_at=datetime.now(UTC) if stored_status == "sent" else None,
            failure_reason=error,
            deduplication_key=f"{deduplication_key}:telegram" if deduplication_key else None,
        )
        db.add(telegram)
        notifications.append(telegram)
    return notifications


def list_notifications(
    db: Session,
    user: User,
    status_filter: str | None,
    limit: int,
    offset: int,
) -> NotificationListRead:
    filters = [Notification.user_id == user.id]
    if status_filter is not None:
        filters.append(Notification.status == status_filter)
    total = db.scalar(select(func.count()).select_from(Notification).where(and_(*filters))) or 0
    unread_count = (
        db.scalar(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user.id,
                Notification.status.in_(["pending", "sent", "failed"]),
                Notification.channel == "in_app",
            )
        )
        or 0
    )
    items = list(
        db.scalars(
            select(Notification)
            .where(and_(*filters))
            .order_by(desc(Notification.created_at))
            .limit(limit)
            .offset(offset)
        ).all()
    )
    return NotificationListRead(
        items=[notification_to_read(item) for item in items],
        total=total,
        unread_count=unread_count,
        limit=limit,
        offset=offset,
    )


def get_user_notification(db: Session, user: User, notification_id: str) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


def mark_notification_read(
    db: Session,
    user: User,
    notification: Notification,
    request: Request | None = None,
) -> Notification:
    notification.status = "read"
    notification.read_at = datetime.now(UTC)
    create_audit_log(
        db,
        "notification_mark_read",
        user.id,
        request,
        {"notification_id": notification.id},
    )
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_notifications_read(
    db: Session,
    user: User,
    request: Request | None = None,
) -> int:
    now = datetime.now(UTC)
    result = db.execute(
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.channel == "in_app",
            Notification.status != "read",
        )
        .values(status="read", read_at=now, updated_at=now)
    )
    count = int(result.rowcount or 0)
    create_audit_log(db, "notification_mark_all_read", user.id, request, {"count": count})
    db.commit()
    return count


def update_notification_preferences(
    db: Session,
    user: User,
    payload: NotificationPreferenceUpdate,
    request: Request | None = None,
) -> NotificationPreference:
    preference = get_notification_preferences(db, user)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(preference, key, value)
    create_audit_log(
        db,
        "notification_preferences_update",
        user.id,
        request,
        {"changed_fields": sorted(changes.keys())},
    )
    db.commit()
    db.refresh(preference)
    return preference


def ensure_telegram_test_allowed(user: User) -> None:
    now = datetime.now(UTC)
    last = telegram_test_limiter.get(user.id)
    if last is not None and (now - last).total_seconds() < 60:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Telegram test rate limit exceeded",
        )
    telegram_test_limiter[user.id] = now


def test_telegram_notification(
    db: Session,
    user: User,
    request: Request | None = None,
) -> Notification:
    ensure_telegram_test_allowed(user)
    preference = get_notification_preferences(db, user)
    if not preference.telegram_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Telegram notifications are disabled for this user",
        )
    result, failure = send_telegram_message("Observer Wealth Intelligence test notification")
    notification = Notification(
        user_id=user.id,
        title="Telegram test",
        message="Test notification requested from settings.",
        type="system",
        channel="telegram",
        severity="info" if result == "sent" else "warning",
        status=result if result in {"sent", "failed"} else "failed",
        sent_at=datetime.now(UTC) if result == "sent" else None,
        failure_reason=failure,
    )
    db.add(notification)
    create_audit_log(db, "telegram_test_notification", user.id, request, {})
    db.commit()
    db.refresh(notification)
    return notification


def should_send_daily_reminder(
    db: Session,
    user: User,
    local_date: date | None = None,
) -> bool:
    preference = get_notification_preferences(db, user)
    if not preference.daily_reminder_enabled:
        return False
    target_date = local_date or user_today(user)
    if str(target_date.isoweekday()) not in preference.daily_reminder_weekdays.split(","):
        return False
    existing_entry = db.scalar(
        select(WealthEntry.id).where(
            WealthEntry.user_id == user.id,
            WealthEntry.entry_date == target_date,
            WealthEntry.realised_profit != 0,
        )
    )
    if existing_entry is not None:
        return False
    dedupe = f"daily_entry_reminder:{user.id}:{target_date.isoformat()}"
    existing_notification = db.scalar(
        select(Notification.id).where(
            Notification.user_id == user.id,
            Notification.deduplication_key == dedupe,
        )
    )
    return existing_notification is None


def create_daily_entry_reminder(
    db: Session,
    user: User,
    local_date: date | None = None,
) -> Notification | None:
    target_date = local_date or user_today(user)
    if not should_send_daily_reminder(db, user, target_date):
        return None
    notifications = notify_user(
        db,
        user,
        title="Record today's results",
        message="If you traded, saved, or moved money today, record the result when ready.",
        notification_type="daily_entry_reminder",
        severity="info",
        deduplication_key=f"daily_entry_reminder:{user.id}:{target_date.isoformat()}",
    )
    db.commit()
    return notifications[0]


def in_quiet_hours(preference: NotificationPreference, now_utc: datetime | None = None) -> bool:
    if preference.quiet_hours_start is None or preference.quiet_hours_end is None:
        return False
    now_local = (now_utc or datetime.now(UTC)).astimezone(ZoneInfo(preference.timezone)).time()
    start_hour, start_minute = (int(part) for part in preference.quiet_hours_start.split(":"))
    end_hour, end_minute = (int(part) for part in preference.quiet_hours_end.split(":"))
    start = time(start_hour, start_minute)
    end = time(end_hour, end_minute)
    if start <= end:
        return start <= now_local <= end
    return now_local >= start or now_local <= end
