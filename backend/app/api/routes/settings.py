from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_owner
from app.models.app_settings import AppSettings
from app.models.user import User
from app.schemas.settings import AppSettingsRead, AppSettingsUpdate
from app.services.settings import get_app_settings, update_app_settings

router = APIRouter()


@router.get("", response_model=AppSettingsRead)
def read_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AppSettings:
    _ = current_user
    return get_app_settings(db)


@router.patch("", response_model=AppSettingsRead)
def update_settings(
    payload: AppSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> AppSettings:
    return update_app_settings(
        db=db,
        current_user=current_user,
        payload=payload,
        request=request,
    )
