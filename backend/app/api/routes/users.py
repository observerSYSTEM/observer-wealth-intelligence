from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.user import PasswordChangeRead, PasswordChangeRequest, UserProfileUpdate, UserRead
from app.services.auth import change_password, update_profile

router = APIRouter()


@router.get("/me", response_model=UserRead)
def read_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
def update_current_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> User:
    return update_profile(db=db, current_user=current_user, payload=payload)


@router.put("/me/password", response_model=PasswordChangeRead)
def update_password(
    payload: PasswordChangeRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> PasswordChangeRead:
    change_password(
        db=db,
        current_user=current_user,
        payload=payload,
        request=request,
        response=response,
    )
    return PasswordChangeRead(message="Password changed. Please log in again.")
