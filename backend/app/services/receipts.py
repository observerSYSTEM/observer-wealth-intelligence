import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.receipt import Receipt
from app.models.user import User
from app.models.wealth_entry import WealthEntry
from app.schemas.receipt import ReceiptRead
from app.services.audit import create_audit_log

ALLOWED_RECEIPT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def storage_root() -> Path:
    return Path(settings.receipt_storage_path).resolve()


def safe_original_filename(filename: str | None) -> str:
    name = Path(filename or "receipt").name.replace("\x00", "")
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .")
    return name[:255] or "receipt"


def validate_signature(content: bytes, media_type: str) -> bool:
    if media_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if media_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if media_type == "image/webp":
        return len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    if media_type == "application/pdf":
        return content.startswith(b"%PDF")
    return False


async def read_upload(upload: UploadFile) -> bytes:
    content = await upload.read(settings.receipt_max_file_size_bytes + 1)
    if len(content) > settings.receipt_max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Receipt file is too large",
        )
    return content


def validate_upload(upload: UploadFile, content: bytes) -> tuple[str, str]:
    original_filename = safe_original_filename(upload.filename)
    extension = Path(original_filename).suffix.lower()
    expected_media_type = ALLOWED_RECEIPT_TYPES.get(extension)
    if expected_media_type is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type",
        )
    if upload.content_type != expected_media_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type",
        )
    if not validate_signature(content, expected_media_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type",
        )
    return original_filename, extension


def receipt_relative_path(user: User, extension: str, uploaded_at: datetime) -> str:
    return str(
        Path(user.id)
        / f"{uploaded_at:%Y}"
        / f"{uploaded_at:%m}"
        / f"{uuid4().hex}{extension}"
    ).replace("\\", "/")


def receipt_file_path(receipt: Receipt) -> Path:
    root = storage_root()
    path = (root / receipt.stored_filename).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid storage path",
        ) from exc
    return path


async def upload_receipt(
    db: Session,
    user: User,
    upload: UploadFile,
    request: Request | None = None,
) -> Receipt:
    content = await read_upload(upload)
    original_filename, extension = validate_upload(upload, content)
    checksum = hashlib.sha256(content).hexdigest()

    existing = db.scalar(
        select(Receipt).where(
            Receipt.user_id == user.id,
            Receipt.sha256 == checksum,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate receipt upload")

    uploaded_at = datetime.now(UTC)
    stored_filename = receipt_relative_path(user, extension, uploaded_at)
    receipt = Receipt(
        user_id=user.id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        media_type=ALLOWED_RECEIPT_TYPES[extension],
        file_size=len(content),
        sha256=checksum,
        storage_backend="local",
        uploaded_at=uploaded_at,
    )
    path = receipt_file_path(receipt)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    db.add(receipt)
    db.flush()
    create_audit_log(db, "receipt_upload", user.id, request, {"receipt_id": receipt.id})
    db.commit()
    db.refresh(receipt)
    return receipt


def get_user_receipt(db: Session, user: User, receipt_id: str) -> Receipt:
    receipt = db.get(Receipt, receipt_id)
    if receipt is None or receipt.user_id != user.id or receipt.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    return receipt


def list_receipts(
    db: Session,
    user: User,
    limit: int,
    offset: int,
) -> tuple[list[Receipt], int]:
    filters = [Receipt.user_id == user.id, Receipt.deleted_at.is_(None)]
    total = db.scalar(select(func.count()).select_from(Receipt).where(*filters)) or 0
    items = db.scalars(
        select(Receipt)
        .where(*filters)
        .order_by(desc(Receipt.uploaded_at))
        .limit(limit)
        .offset(offset)
    ).all()
    return list(items), total


def linked_entry_id(db: Session, receipt: Receipt) -> str | None:
    return db.scalar(select(WealthEntry.id).where(WealthEntry.receipt_id == receipt.id))


def receipt_to_read(db: Session, receipt: Receipt) -> ReceiptRead:
    return ReceiptRead.model_validate(receipt, from_attributes=True).model_copy(
        update={"linked_entry_id": linked_entry_id(db, receipt)}
    )


def receipt_content_response(receipt: Receipt) -> FileResponse:
    path = receipt_file_path(receipt)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt content not found",
        )
    return FileResponse(
        path,
        media_type=receipt.media_type,
        filename=receipt.original_filename,
    )


def delete_receipt(
    db: Session,
    user: User,
    receipt: Receipt,
    request: Request | None = None,
) -> None:
    path = receipt_file_path(receipt)
    if path.exists():
        path.unlink()
    receipt.deleted_at = datetime.now(UTC)
    db.execute(
        update(WealthEntry).where(WealthEntry.receipt_id == receipt.id).values(receipt_id=None)
    )
    create_audit_log(db, "receipt_delete", user.id, request, {"receipt_id": receipt.id})
    db.commit()
