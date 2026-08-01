from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.ocr import OCRJobCreate, OCRResultConfirm, OCRResultListRead, OCRResultRead
from app.services.ocr import (
    confirm_ocr_result,
    create_ocr_result,
    get_user_ocr_result,
    list_ocr_results,
    ocr_to_read,
)

router = APIRouter()


@router.post("/jobs", response_model=OCRResultRead, status_code=status.HTTP_201_CREATED)
def create_ocr_job(
    payload: OCRJobCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> OCRResultRead:
    return ocr_to_read(create_ocr_result(db, current_user, payload, request))


@router.get("/results", response_model=OCRResultListRead)
def read_ocr_results(
    source_type: str | None = None,
    source_id: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OCRResultListRead:
    return list_ocr_results(db, current_user, source_type, source_id, limit, offset)


@router.get("/results/{result_id}", response_model=OCRResultRead)
def read_ocr_result(
    result_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OCRResultRead:
    return ocr_to_read(get_user_ocr_result(db, current_user, result_id))


@router.patch("/results/{result_id}/confirm", response_model=OCRResultRead)
def confirm_user_ocr_result(
    result_id: str,
    payload: OCRResultConfirm,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> OCRResultRead:
    result = get_user_ocr_result(db, current_user, result_id)
    return ocr_to_read(confirm_ocr_result(db, current_user, result, payload, request))
