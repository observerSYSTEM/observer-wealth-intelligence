from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, generate_secret_token, hash_secret_token
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.services.audit import request_ip, request_user_agent


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


@dataclass(frozen=True)
class IssuedSession:
    refresh_session: RefreshSession
    access_token: str
    refresh_token: str
    csrf_token: str
    access_token_expires_at: datetime


def create_refresh_session(
    db: Session,
    user: User,
    request: Request | None = None,
) -> IssuedSession:
    refresh_token = generate_secret_token()
    csrf_token = generate_secret_token()
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)

    refresh_session = RefreshSession(
        user_id=user.id,
        token_hash=hash_secret_token(refresh_token),
        csrf_token_hash=hash_secret_token(csrf_token),
        expires_at=expires_at,
        ip_address=request_ip(request),
        user_agent=request_user_agent(request),
    )
    db.add(refresh_session)
    db.flush()

    access_token_expires_at = now + timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        subject=user.id,
        session_id=refresh_session.id,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return IssuedSession(
        refresh_session=refresh_session,
        access_token=access_token,
        refresh_token=refresh_token,
        csrf_token=csrf_token,
        access_token_expires_at=access_token_expires_at,
    )


def set_auth_cookies(response: Response, issued_session: IssuedSession) -> None:
    response.set_cookie(
        settings.access_cookie_name,
        issued_session.access_token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.secure_cookies,
        samesite=settings.cookie_samesite,
        path="/",
    )
    response.set_cookie(
        settings.refresh_cookie_name,
        issued_session.refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.secure_cookies,
        samesite=settings.cookie_samesite,
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        issued_session.csrf_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=False,
        secure=settings.secure_cookies,
        samesite=settings.cookie_samesite,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    for cookie_name in (
        settings.access_cookie_name,
        settings.refresh_cookie_name,
        settings.csrf_cookie_name,
    ):
        response.delete_cookie(cookie_name, path="/", samesite=settings.cookie_samesite)


def get_active_refresh_session(db: Session, session_id: str) -> RefreshSession | None:
    now = datetime.now(UTC)
    return db.scalar(
        select(RefreshSession).where(
            RefreshSession.id == session_id,
            RefreshSession.revoked_at.is_(None),
            RefreshSession.expires_at > now,
        )
    )


def revoke_refresh_session(db: Session, refresh_session: RefreshSession) -> None:
    if refresh_session.revoked_at is None:
        refresh_session.revoked_at = datetime.now(UTC)


def revoke_user_refresh_sessions(db: Session, user_id: str) -> None:
    db.execute(
        update(RefreshSession)
        .where(RefreshSession.user_id == user_id, RefreshSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def validate_csrf_for_session(
    db: Session,
    session_id: str | None,
    csrf_header: str | None,
    csrf_cookie: str | None,
) -> RefreshSession:
    if not session_id or not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")

    refresh_session = get_active_refresh_session(db, session_id)
    if refresh_session is None or hash_secret_token(csrf_header) != refresh_session.csrf_token_hash:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")
    return refresh_session


def rotate_refresh_session(
    db: Session,
    request: Request,
    response: Response,
    refresh_token: str | None,
    csrf_header: str | None,
    csrf_cookie: str | None,
) -> IssuedSession:
    if not refresh_token or not csrf_header or not csrf_cookie or csrf_header != csrf_cookie:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token_hash = hash_secret_token(refresh_token)
    refresh_session = db.scalar(
        select(RefreshSession).where(RefreshSession.token_hash == token_hash)
    )
    if refresh_session is None:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    if refresh_session.revoked_at is not None:
        revoke_user_refresh_sessions(db, refresh_session.user_id)
        db.commit()
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    now = datetime.now(UTC)
    if as_utc(refresh_session.expires_at) <= now:
        revoke_refresh_session(db, refresh_session)
        db.commit()
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    if hash_secret_token(csrf_header) != refresh_session.csrf_token_hash:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")

    user = db.get(User, refresh_session.user_id)
    if user is None or not user.is_active:
        revoke_refresh_session(db, refresh_session)
        db.commit()
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    issued_session = create_refresh_session(db=db, user=user, request=request)
    refresh_session.revoked_at = now
    refresh_session.replaced_by_id = issued_session.refresh_session.id
    refresh_session.last_used_at = now
    db.commit()
    db.refresh(user)
    set_auth_cookies(response, issued_session)
    return issued_session
