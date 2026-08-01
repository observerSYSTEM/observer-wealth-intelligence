import re
import tempfile
from datetime import UTC, date, datetime
from decimal import Decimal
from importlib import import_module
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ocr_result import OCRResult
from app.models.receipt import Receipt
from app.models.user import User
from app.models.vault_document import VaultDocument
from app.schemas.ocr import OCRJobCreate, OCRResultConfirm, OCRResultListRead, OCRResultRead
from app.services.audit import create_audit_log
from app.services.entries import quantize_money
from app.services.receipts import receipt_file_path
from app.services.vault import document_file_path

OCR_SUPPORTED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
CURRENCY_MARKERS = {
    "GBP": "GBP",
    "USD": "USD",
    "NGN": "NGN",
    "EUR": "EUR",
    "£": "GBP",
    "$": "USD",
    "₦": "NGN",
    "€": "EUR",
}


def ocr_root() -> Path:
    return Path(settings.ocr_storage_path).resolve()


def ocr_artifact_path(result: OCRResult) -> Path:
    root = ocr_root()
    path = (
        root
        / result.user_id
        / result.source_type
        / result.source_id
        / f"{result.id}.txt"
    ).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid OCR storage path",
        ) from exc
    return path


def easyocr_reader() -> Any:
    try:
        easyocr = import_module("easyocr")
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCR engine is not installed",
        ) from exc
    return easyocr.Reader(settings.easyocr_languages, gpu=False)


def read_image_text(reader: Any, image_path: Path) -> tuple[list[str], list[Decimal]]:
    rows = reader.readtext(str(image_path), detail=1)
    text_lines: list[str] = []
    confidences: list[Decimal] = []
    for row in rows:
        if len(row) >= 3:
            text_lines.append(str(row[1]))
            confidences.append(Decimal(str(row[2])) * Decimal("100"))
    return text_lines, confidences


def run_easyocr(path: Path, media_type: str) -> tuple[str, Decimal]:
    reader = easyocr_reader()
    text_lines: list[str] = []
    confidences: list[Decimal] = []

    if media_type == "application/pdf":
        try:
            fitz = import_module("fitz")
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PDF OCR renderer is not installed",
            ) from exc
        with tempfile.TemporaryDirectory() as temp_dir:
            document = fitz.open(path)
            for page_index in range(min(document.page_count, 5)):
                page = document.load_page(page_index)
                pixmap = page.get_pixmap()
                image_path = Path(temp_dir) / f"page-{page_index}.png"
                pixmap.save(image_path)
                lines, scores = read_image_text(reader, image_path)
                text_lines.extend(lines)
                confidences.extend(scores)
    else:
        text_lines, confidences = read_image_text(reader, path)

    confidence = (
        quantize_money(sum(confidences, Decimal("0.00")) / Decimal(len(confidences)))
        if confidences
        else Decimal("0.00")
    )
    return "\n".join(text_lines), confidence


def parse_amount_and_currency(text: str) -> tuple[Decimal | None, str | None]:
    marker = r"(GBP|USD|NGN|EUR|£|\$|₦|€)"
    amount = r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)"
    patterns = [rf"{marker}\s*{amount}", rf"{amount}\s*{marker}"]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match is None:
            continue
        groups = match.groups()
        if groups[0].upper() in CURRENCY_MARKERS or groups[0] in CURRENCY_MARKERS:
            currency_marker = groups[0].upper() if groups[0].isalpha() else groups[0]
            amount_text = groups[1]
        else:
            amount_text = groups[0]
            currency_marker = groups[1].upper() if groups[1].isalpha() else groups[1]
        currency = CURRENCY_MARKERS[currency_marker]
        return quantize_money(Decimal(amount_text.replace(",", ""))), currency
    return None, None


def parse_document_date(text: str) -> date | None:
    iso_match = re.search(r"\b(20[0-9]{2})-(0[1-9]|1[0-2])-([0-3][0-9])\b", text)
    if iso_match:
        return date.fromisoformat(iso_match.group(0))
    slash_match = re.search(r"\b([0-3]?[0-9])/([01]?[0-9])/(20[0-9]{2})\b", text)
    if slash_match:
        day, month, year = slash_match.groups()
        return date(int(year), int(month), int(day))
    return None


def parse_document_time(text: str) -> str | None:
    match = re.search(r"\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b", text)
    if match is None:
        return None
    hour, minute = match.groups()
    return f"{int(hour):02d}:{minute}"


def parse_reference(text: str) -> str | None:
    match = re.search(
        r"\b(?:reference|ref|transaction|id)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{2,80})",
        text,
        flags=re.IGNORECASE,
    )
    return match.group(1) if match else None


def source_path_and_media_type(
    db: Session,
    user: User,
    payload: OCRJobCreate,
) -> tuple[Path, str]:
    if payload.source_type == "receipt":
        receipt = db.get(Receipt, payload.source_id)
        if receipt is None or receipt.user_id != user.id or receipt.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
        return receipt_file_path(receipt), receipt.media_type

    document = db.get(VaultDocument, payload.source_id)
    if document is None or document.user_id != user.id or document.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document_file_path(document), document.media_type


def create_ocr_result(
    db: Session,
    user: User,
    payload: OCRJobCreate,
    request: Request | None = None,
) -> OCRResult:
    source_path, media_type = source_path_and_media_type(db, user, payload)
    if media_type not in OCR_SUPPORTED_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="OCR is not supported for this document type",
        )
    if not source_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")

    extracted_text, confidence = run_easyocr(source_path, media_type)
    amount, currency = parse_amount_and_currency(extracted_text)
    result = OCRResult(
        user_id=user.id,
        source_type=payload.source_type,
        source_id=payload.source_id,
        extracted_text=extracted_text,
        amount=amount,
        currency=currency,
        document_date=parse_document_date(extracted_text),
        document_time=parse_document_time(extracted_text),
        reference=parse_reference(extracted_text),
        confidence_score=confidence,
        status="pending_review",
    )
    db.add(result)
    db.flush()
    path = ocr_artifact_path(result)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(extracted_text, encoding="utf-8")
    create_audit_log(db, "ocr_result_create", user.id, request, {"ocr_result_id": result.id})
    db.commit()
    db.refresh(result)
    return result


def get_user_ocr_result(db: Session, user: User, result_id: str) -> OCRResult:
    result = db.get(OCRResult, result_id)
    if result is None or result.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR result not found")
    return result


def confirm_ocr_result(
    db: Session,
    user: User,
    result: OCRResult,
    payload: OCRResultConfirm,
    request: Request | None = None,
) -> OCRResult:
    result.amount = payload.amount
    result.currency = payload.currency
    result.document_date = payload.document_date
    result.document_time = payload.document_time
    result.reference = payload.reference
    result.status = payload.status
    result.confirmed_at = datetime.now(UTC) if payload.status == "confirmed" else None
    create_audit_log(db, "ocr_result_confirm", user.id, request, {"ocr_result_id": result.id})
    db.commit()
    db.refresh(result)
    return result


def ocr_to_read(result: OCRResult) -> OCRResultRead:
    return OCRResultRead.model_validate(result, from_attributes=True)


def list_ocr_results(
    db: Session,
    user: User,
    source_type: str | None,
    source_id: str | None,
    limit: int,
    offset: int,
) -> OCRResultListRead:
    filters = [OCRResult.user_id == user.id]
    if source_type is not None:
        filters.append(OCRResult.source_type == source_type)
    if source_id is not None:
        filters.append(OCRResult.source_id == source_id)
    total = db.scalar(select(func.count()).select_from(OCRResult).where(and_(*filters))) or 0
    items = list(
        db.scalars(
            select(OCRResult)
            .where(and_(*filters))
            .order_by(desc(OCRResult.created_at))
            .limit(limit)
            .offset(offset)
        ).all()
    )
    return OCRResultListRead(
        items=[ocr_to_read(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
