from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummaryRead
from app.services.dashboard import dashboard_summary

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryRead)
def read_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummaryRead:
    return dashboard_summary(db, current_user)
