from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.common import MessageRead
from app.schemas.notification import (
    NotificationCreate,
    NotificationListRead,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    NotificationRead,
)
from app.services.notifications import (
    create_notification,
    get_notification_preferences,
    get_user_notification,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    notification_to_read,
    preference_to_read,
    test_telegram_notification,
    update_notification_preferences,
)

router = APIRouter()


@router.get("", response_model=NotificationListRead)
def read_notifications(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationListRead:
    return list_notifications(db, current_user, status_filter, limit, offset)


@router.post("", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
def create_user_notification(
    payload: NotificationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> NotificationRead:
    return notification_to_read(create_notification(db, current_user, payload, request))


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def read_user_notification(
    notification_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> NotificationRead:
    notification = get_user_notification(db, current_user, notification_id)
    return notification_to_read(mark_notification_read(db, current_user, notification, request))


@router.post("/read-all", response_model=MessageRead)
def read_all_user_notifications(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    count = mark_all_notifications_read(db, current_user, request)
    return MessageRead(message=f"{count} notifications marked read")


@router.get("/preferences", response_model=NotificationPreferenceRead)
def read_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceRead:
    return preference_to_read(get_notification_preferences(db, current_user))


@router.patch("/preferences", response_model=NotificationPreferenceRead)
def update_user_notification_preferences(
    payload: NotificationPreferenceUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> NotificationPreferenceRead:
    preference = update_notification_preferences(db, current_user, payload, request)
    return preference_to_read(preference)


@router.post("/test-telegram", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
def create_test_telegram_notification(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> NotificationRead:
    return notification_to_read(test_telegram_notification(db, current_user, request))
