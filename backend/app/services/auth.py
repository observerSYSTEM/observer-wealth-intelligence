import hashlib
from datetime import UTC, datetime

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.schemas.auth import AuthSessionRead, LoginRequest, RegisterRequest, SetupStatusRead
from app.schemas.user import PasswordChangeRequest, UserProfileUpdate, UserRead
from app.services.audit import create_audit_log, request_ip
from app.services.rate_limit import login_rate_limiter
from app.services.sessions import (
    clear_auth_cookies,
    create_refresh_session,
    revoke_refresh_session,
    revoke_user_refresh_sessions,
    set_auth_cookies,
)
from app.services.settings import get_app_settings

AUTH_ERROR_DETAIL = "Invalid email or password"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def owner_exists(db: Session) -> bool:
    return (
        db.scalar(select(func.count()).select_from(User).where(User.role == "owner")) or 0
    ) > 0


def setup_status(db: Session) -> SetupStatusRead:
    app_settings = get_app_settings(db)
    return SetupStatusRead(
        owner_exists=owner_exists(db),
        registration_enabled=app_settings.registration_enabled,
    )


def _email_hash(email: str) -> str:
    return hashlib.sha256(normalize_email(email).encode()).hexdigest()


def register_user(
    db: Session,
    payload: RegisterRequest,
    request: Request,
    response: Response,
) -> AuthSessionRead:
    email = normalize_email(str(payload.email))
    app_settings = get_app_settings(db)
    has_owner = owner_exists(db)

    if has_owner and not app_settings.registration_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is disabled",
        )

    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    role = "user" if has_owner else "owner"
    user = User(
        email=email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        role=role,
        is_verified=True,
        timezone=payload.timezone,
        preferred_currency=payload.preferred_currency,
    )
    db.add(user)
    db.flush()

    if role == "owner":
        app_settings.registration_enabled = False

    issued_session = create_refresh_session(db=db, user=user, request=request)
    create_audit_log(
        db=db,
        action="first_owner_registration" if role == "owner" else "user_registration",
        user_id=user.id,
        request=request,
    )
    db.commit()
    db.refresh(user)
    set_auth_cookies(response, issued_session)
    return AuthSessionRead(
        user=UserRead.model_validate(user, from_attributes=True),
        access_token_expires_at=issued_session.access_token_expires_at,
    )


def login_user(
    db: Session,
    payload: LoginRequest,
    request: Request,
    response: Response,
) -> AuthSessionRead:
    email = normalize_email(str(payload.email))
    rate_key = f"{request_ip(request) or 'unknown'}:{email}"
    login_rate_limiter.ensure_allowed(rate_key)

    user = db.scalar(select(User).where(User.email == email))
    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.password_hash)
    ):
        login_rate_limiter.record_failure(rate_key)
        create_audit_log(
            db=db,
            action="login_failed",
            user_id=user.id if user is not None else None,
            request=request,
            details={"email_hash": _email_hash(email)},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=AUTH_ERROR_DETAIL)

    login_rate_limiter.record_success(rate_key)
    user.last_login_at = datetime.now(UTC)
    issued_session = create_refresh_session(db=db, user=user, request=request)
    create_audit_log(db=db, action="login", user_id=user.id, request=request)
    db.commit()
    db.refresh(user)
    set_auth_cookies(response, issued_session)
    return AuthSessionRead(
        user=UserRead.model_validate(user, from_attributes=True),
        access_token_expires_at=issued_session.access_token_expires_at,
    )


def logout_user(
    db: Session,
    current_user: User,
    refresh_session: RefreshSession,
    request: Request,
    response: Response,
) -> None:
    revoke_refresh_session(db, refresh_session)
    create_audit_log(db=db, action="logout", user_id=current_user.id, request=request)
    db.commit()
    clear_auth_cookies(response)


def update_profile(db: Session, current_user: User, payload: UserProfileUpdate) -> User:
    if payload.email is not None:
        email = normalize_email(str(payload.email))
        if email != current_user.email:
            if not payload.password_confirmation or not verify_password(
                payload.password_confirmation,
                current_user.password_hash,
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password confirmation is required to change email",
                )
            existing = db.scalar(
                select(User).where(User.email == email, User.id != current_user.id)
            )
            if existing is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this email already exists",
                )
            current_user.email = email

    if payload.display_name is not None:
        current_user.display_name = payload.display_name
    if payload.timezone is not None:
        current_user.timezone = payload.timezone
    if payload.preferred_currency is not None:
        current_user.preferred_currency = payload.preferred_currency

    db.commit()
    db.refresh(current_user)
    return current_user


def change_password(
    db: Session,
    current_user: User,
    payload: PasswordChangeRequest,
    request: Request,
    response: Response,
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password_hash = hash_password(payload.new_password)
    revoke_user_refresh_sessions(db, current_user.id)
    create_audit_log(db=db, action="password_change", user_id=current_user.id, request=request)
    db.commit()
    clear_auth_cookies(response)


def authentication_cookie_settings() -> dict[str, str | bool | int]:
    return {
        "access_cookie": settings.access_cookie_name,
        "refresh_cookie": settings.refresh_cookie_name,
        "csrf_cookie": settings.csrf_cookie_name,
        "secure": settings.secure_cookies,
        "same_site": settings.cookie_samesite,
    }
