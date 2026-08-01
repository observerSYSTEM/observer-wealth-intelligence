from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.notification import NotificationPreferenceRead, NotificationPreferenceUpdate
from app.services.notifications import (
    get_notification_preferences,
    preference_to_read,
    update_notification_preferences,
)

router = APIRouter()


@router.get("", response_model=NotificationPreferenceRead)
def read_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceRead:
    return preference_to_read(get_notification_preferences(db, current_user))


@router.patch("", response_model=NotificationPreferenceRead)
def update_user_notification_preferences(
    payload: NotificationPreferenceUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> NotificationPreferenceRead:
    preference = update_notification_preferences(db, current_user, payload, request)
    return preference_to_read(preference)
