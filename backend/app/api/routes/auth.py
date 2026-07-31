from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.core.config import settings
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.schemas.auth import AuthSessionRead, LoginRequest, RegisterRequest, SetupStatusRead
from app.schemas.common import MessageRead
from app.schemas.user import UserRead
from app.services.auth import login_user, logout_user, register_user, setup_status
from app.services.sessions import rotate_refresh_session

router = APIRouter()


@router.get("/setup-status", response_model=SetupStatusRead)
def read_setup_status(db: Session = Depends(get_db)) -> SetupStatusRead:
    return setup_status(db)


@router.post("/register", response_model=AuthSessionRead, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionRead:
    return register_user(db=db, payload=payload, request=request, response=response)


@router.post("/login", response_model=AuthSessionRead)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionRead:
    return login_user(db=db, payload=payload, request=request, response=response)


@router.post("/refresh", response_model=AuthSessionRead)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionRead:
    issued_session = rotate_refresh_session(
        db=db,
        request=request,
        response=response,
        refresh_token=request.cookies.get(settings.refresh_cookie_name),
        csrf_header=request.headers.get("x-csrf-token"),
        csrf_cookie=request.cookies.get(settings.csrf_cookie_name),
    )
    user = db.get(User, issued_session.refresh_session.user_id)
    if user is None:
        raise RuntimeError("Refresh session user disappeared during token rotation")
    return AuthSessionRead(
        user=user,
        access_token_expires_at=issued_session.access_token_expires_at,
    )


@router.post("/logout", response_model=MessageRead)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    refresh_session_id = getattr(request.state, "refresh_session_id", None)
    if refresh_session_id is not None:
        refresh_session = db.get(RefreshSession, refresh_session_id)
        if refresh_session is not None:
            logout_user(
                db=db,
                current_user=current_user,
                refresh_session=refresh_session,
                request=request,
                response=response,
            )
    return MessageRead(message="Logged out")


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user
