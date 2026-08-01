import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.asset import Asset
from app.models.user import User
from app.models.vault_document import VaultDocument
from app.schemas.asset import normalize_text
from app.schemas.vault import (
    VaultDocumentListRead,
    VaultDocumentRead,
    VaultDocumentUpdate,
    VaultFolderSummaryRead,
)
from app.services.audit import create_audit_log

ALLOWED_VAULT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}

VAULT_FOLDERS = {
    "receipts",
    "certificates",
    "passports",
    "land_documents",
    "company_documents",
    "tax_documents",
    "trading_statements",
    "insurance",
    "other",
}


def vault_root() -> Path:
    return Path(settings.vault_storage_path).resolve()


def asset_root() -> Path:
    return Path(settings.asset_storage_path).resolve()


def safe_original_filename(filename: str | None) -> str:
    name = Path(filename or "document").name.replace("\x00", "")
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .")
    return name[:255] or "document"


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
    content = await upload.read(settings.vault_max_file_size_bytes + 1)
    if len(content) > settings.vault_max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Vault document is too large",
        )
    return content


def validate_upload(upload: UploadFile, content: bytes) -> tuple[str, str, str]:
    original_filename = safe_original_filename(upload.filename)
    extension = Path(original_filename).suffix.lower()
    expected_media_type = ALLOWED_VAULT_TYPES.get(extension)
    if expected_media_type is None or upload.content_type != expected_media_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported document type",
        )
    if not validate_signature(content, expected_media_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported document type",
        )
    return original_filename, extension, expected_media_type


def generated_filename(extension: str) -> str:
    return f"{uuid4().hex}{extension}"


def document_root(document: VaultDocument) -> Path:
    if document.storage_area == "asset":
        return asset_root()
    return vault_root()


def document_file_path(document: VaultDocument) -> Path:
    root = document_root(document)
    uploaded_at = document.uploaded_at
    if document.storage_area == "asset":
        if document.asset_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Asset document is missing asset link",
            )
        path = (
            root
            / document.user_id
            / document.asset_id
            / f"{uploaded_at:%Y}"
            / f"{uploaded_at:%m}"
            / document.encrypted_filename
        ).resolve()
    else:
        path = (
            root
            / document.user_id
            / document.folder
            / f"{uploaded_at:%Y}"
            / f"{uploaded_at:%m}"
            / document.encrypted_filename
        ).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid document storage path",
        ) from exc
    return path


def ensure_folder(folder: str) -> None:
    if folder not in VAULT_FOLDERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid folder",
        )


def ensure_asset_owner(db: Session, user: User, asset_id: str | None) -> None:
    if asset_id is None:
        return
    asset = db.get(Asset, asset_id)
    if asset is None or asset.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")


async def upload_document(
    db: Session,
    user: User,
    upload: UploadFile,
    folder: str,
    tags: str | None,
    notes: str | None,
    request: Request | None = None,
    asset_id: str | None = None,
    storage_area: str = "vault",
) -> VaultDocument:
    ensure_folder(folder)
    ensure_asset_owner(db, user, asset_id)
    content = await read_upload(upload)
    original_filename, extension, media_type = validate_upload(upload, content)
    checksum = hashlib.sha256(content).hexdigest()
    existing = db.scalar(
        select(VaultDocument).where(
            VaultDocument.user_id == user.id,
            VaultDocument.sha256 == checksum,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate document upload",
        )

    uploaded_at = datetime.now(UTC)
    document = VaultDocument(
        user_id=user.id,
        asset_id=asset_id,
        folder=folder,
        storage_area=storage_area,
        original_filename=original_filename,
        encrypted_filename=generated_filename(extension),
        media_type=media_type,
        file_size=len(content),
        sha256=checksum,
        checksum=checksum,
        tags=normalize_text(tags),
        notes=normalize_text(notes),
        uploaded_at=uploaded_at,
    )
    path = document_file_path(document)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    db.add(document)
    db.flush()
    create_audit_log(db, "vault_document_upload", user.id, request, {"document_id": document.id})
    db.commit()
    db.refresh(document)
    return document


def get_user_document(db: Session, user: User, document_id: str) -> VaultDocument:
    document = db.get(VaultDocument, document_id)
    if document is None or document.user_id != user.id or document.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def document_to_read(document: VaultDocument) -> VaultDocumentRead:
    return VaultDocumentRead.model_validate(document, from_attributes=True)


def list_documents(
    db: Session,
    user: User,
    folder: str | None,
    search: str | None,
    limit: int,
    offset: int,
    asset_id: str | None = None,
) -> VaultDocumentListRead:
    filters = [VaultDocument.user_id == user.id, VaultDocument.deleted_at.is_(None)]
    if folder is not None:
        ensure_folder(folder)
        filters.append(VaultDocument.folder == folder)
    if asset_id is not None:
        filters.append(VaultDocument.asset_id == asset_id)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                VaultDocument.original_filename.ilike(pattern),
                VaultDocument.tags.ilike(pattern),
                VaultDocument.notes.ilike(pattern),
            )
        )
    total = db.scalar(select(func.count()).select_from(VaultDocument).where(and_(*filters))) or 0
    items = list(
        db.scalars(
            select(VaultDocument)
            .where(and_(*filters))
            .order_by(desc(VaultDocument.uploaded_at))
            .limit(limit)
            .offset(offset)
        ).all()
    )
    return VaultDocumentListRead(
        items=[document_to_read(document) for document in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def folder_summaries(db: Session, user: User) -> list[VaultFolderSummaryRead]:
    rows = db.execute(
        select(VaultDocument.folder, func.count())
        .where(VaultDocument.user_id == user.id, VaultDocument.deleted_at.is_(None))
        .group_by(VaultDocument.folder)
    ).all()
    counts = {folder: count for folder, count in rows}
    return [
        VaultFolderSummaryRead(folder=folder, document_count=int(counts.get(folder, 0)))
        for folder in sorted(VAULT_FOLDERS)
    ]


def content_response(document: VaultDocument) -> FileResponse:
    path = document_file_path(document)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document content not found",
        )
    return FileResponse(path, media_type=document.media_type, filename=document.original_filename)


def update_document(
    db: Session,
    user: User,
    document: VaultDocument,
    payload: VaultDocumentUpdate,
    request: Request | None = None,
) -> VaultDocument:
    old_path = document_file_path(document)
    changes = payload.model_dump(exclude_unset=True)
    if "folder" in changes:
        ensure_folder(changes["folder"])
    for key, value in changes.items():
        setattr(document, key, value)
    new_path = document_file_path(document)
    if old_path != new_path and old_path.exists():
        new_path.parent.mkdir(parents=True, exist_ok=True)
        old_path.replace(new_path)
    create_audit_log(db, "vault_document_update", user.id, request, {"document_id": document.id})
    db.commit()
    db.refresh(document)
    return document


def delete_document(
    db: Session,
    user: User,
    document: VaultDocument,
    request: Request | None = None,
) -> None:
    path = document_file_path(document)
    if path.exists():
        path.unlink()
    document.deleted_at = datetime.now(UTC)
    create_audit_log(db, "vault_document_delete", user.id, request, {"document_id": document.id})
    db.commit()
