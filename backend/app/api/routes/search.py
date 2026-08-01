from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.search import SearchResultsRead
from app.services.search import global_search

router = APIRouter()


@router.get("", response_model=SearchResultsRead)
def search_all(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResultsRead:
    return global_search(db, current_user, q, limit)
