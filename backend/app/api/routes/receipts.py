from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.common import MessageRead
from app.schemas.receipt import ReceiptListRead, ReceiptRead
from app.services.receipts import (
    delete_receipt,
    get_user_receipt,
    list_receipts,
    receipt_content_response,
    receipt_to_read,
    upload_receipt,
)

router = APIRouter()


@router.post("", response_model=ReceiptRead, status_code=status.HTTP_201_CREATED)
async def upload_user_receipt(
    request: Request,
    receipt: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> ReceiptRead:
    uploaded_receipt = await upload_receipt(db, current_user, receipt, request)
    return receipt_to_read(db, uploaded_receipt)


@router.get("", response_model=ReceiptListRead)
def read_receipts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptListRead:
    receipts, total = list_receipts(db, current_user, limit, offset)
    return ReceiptListRead(
        items=[receipt_to_read(db, receipt) for receipt in receipts],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{receipt_id}", response_model=ReceiptRead)
def read_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReceiptRead:
    receipt = get_user_receipt(db, current_user, receipt_id)
    return receipt_to_read(db, receipt)


@router.get("/{receipt_id}/content", response_class=FileResponse)
def read_receipt_content(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    receipt = get_user_receipt(db, current_user, receipt_id)
    return receipt_content_response(receipt)


@router.delete("/{receipt_id}", response_model=MessageRead)
def delete_user_receipt(
    receipt_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    receipt = get_user_receipt(db, current_user, receipt_id)
    delete_receipt(db, current_user, receipt, request)
    return MessageRead(message="Receipt deleted")
