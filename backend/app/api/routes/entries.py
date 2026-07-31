from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.common import MessageRead
from app.schemas.entry import EntryCreate, EntryListRead, EntryRead, EntryUpdate
from app.services.entries import (
    create_entry,
    delete_entry,
    entry_to_read,
    get_user_entry,
    list_entries,
    update_entry,
)

router = APIRouter()


@router.post("", response_model=EntryRead, status_code=status.HTTP_201_CREATED)
def create_wealth_entry(
    payload: EntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> EntryRead:
    entry = create_entry(db=db, user=current_user, payload=payload, request=request)
    return entry_to_read(entry, current_user)


@router.get("", response_model=EntryListRead)
def read_entries(
    start_date: date | None = None,
    end_date: date | None = None,
    income_source: str | None = None,
    currency: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryListRead:
    items, total = list_entries(
        db=db,
        user=current_user,
        start_date=start_date,
        end_date=end_date,
        income_source=income_source,
        currency=currency,
        limit=limit,
        offset=offset,
    )
    return EntryListRead(
        items=[entry_to_read(entry, current_user) for entry in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{entry_id}", response_model=EntryRead)
def read_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryRead:
    return entry_to_read(get_user_entry(db, current_user, entry_id), current_user)


@router.patch("/{entry_id}", response_model=EntryRead)
def update_wealth_entry(
    entry_id: str,
    payload: EntryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> EntryRead:
    entry = get_user_entry(db, current_user, entry_id)
    updated_entry = update_entry(db, current_user, entry, payload, request)
    return entry_to_read(updated_entry, current_user)


@router.delete("/{entry_id}", response_model=MessageRead)
def delete_wealth_entry(
    entry_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    entry = get_user_entry(db, current_user, entry_id)
    delete_entry(db, current_user, entry, request)
    return MessageRead(message="Entry deleted")
