from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models.app_settings import AppSettings
from app.models.user import User
from app.schemas.settings import AppSettingsUpdate
from app.services.audit import create_audit_log

SETTINGS_ID = 1


def get_app_settings(db: Session) -> AppSettings:
    app_settings = db.get(AppSettings, SETTINGS_ID)
    if app_settings is None:
        app_settings = AppSettings(id=SETTINGS_ID)
        db.add(app_settings)
        db.flush()
    return app_settings


def validate_allocation_total(
    savings_percentage: int,
    business_percentage: int,
    living_percentage: int,
) -> None:
    if savings_percentage + business_percentage + living_percentage != 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Savings, business, and living percentages must total exactly 100",
        )


def update_app_settings(
    db: Session,
    current_user: User,
    payload: AppSettingsUpdate,
    request: Request | None = None,
) -> AppSettings:
    app_settings = get_app_settings(db)
    changes = payload.model_dump(exclude_unset=True)

    savings = changes.get("savings_percentage", app_settings.savings_percentage)
    business = changes.get("business_percentage", app_settings.business_percentage)
    living = changes.get("living_percentage", app_settings.living_percentage)
    validate_allocation_total(savings, business, living)

    for key, value in changes.items():
        setattr(app_settings, key, value)

    create_audit_log(
        db=db,
        action="settings_change",
        user_id=current_user.id,
        request=request,
        details={"changed_fields": sorted(changes.keys())},
    )
    db.commit()
    db.refresh(app_settings)
    return app_settings
