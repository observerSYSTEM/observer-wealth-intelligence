from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.schemas.health import HealthRead

router = APIRouter()


@router.get("/health", response_model=HealthRead)
def read_health(db: Session = Depends(get_db)) -> HealthRead:
    db.execute(text("SELECT 1"))
    return HealthRead(
        status="ok",
        database="ok",
        environment=settings.environment,
        version=settings.app_version,
    )
