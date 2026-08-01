from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.timeline import TimelineListRead
from app.services.timeline import timeline_events

router = APIRouter()


@router.get("", response_model=TimelineListRead)
def read_timeline(
    limit: int = Query(default=40, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    event_type: str | None = None,
    entity_type: str | None = None,
    sort: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TimelineListRead:
    return timeline_events(
        db,
        current_user,
        limit,
        offset,
        start_at,
        end_at,
        event_type,
        entity_type,
        sort,
    )
