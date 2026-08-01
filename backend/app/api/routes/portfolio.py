from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.portfolio import PortfolioSummaryRead
from app.services.portfolio import portfolio_summary

router = APIRouter()


@router.get("/summary", response_model=PortfolioSummaryRead)
def read_portfolio_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PortfolioSummaryRead:
    return portfolio_summary(db, current_user)
