import json
import logging
import re
import tempfile
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from importlib import import_module, metadata
from pathlib import Path
from time import perf_counter
from typing import Any, cast

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ocr_result import OCRResult
from app.models.receipt import Receipt
from app.models.user import User
from app.models.vault_document import VaultDocument
from app.schemas.ocr import (
    OCRJobCreate,
    OCRResultConfirm,
    OCRResultListRead,
    OCRResultRead,
    OCRSourceType,
)
from app.services.audit import create_audit_log
from app.services.entries import quantize_money
from app.services.notifications import notify_user
from app.services.receipts import receipt_file_path
from app.services.vault import document_file_path

logger = logging.getLogger(__name__)

OCR_SUPPORTED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
ACTIVE_OCR_STATUSES = ("pending", "processing", "review_required")
CURRENCY_MARKERS = {
    "GBP": "GBP",
    "USD": "USD",
    "NGN": "NGN",
    "EUR": "EUR",
    "\u00a3": "GBP",
    "\u00c2\u00a3": "GBP",
    "$": "USD",
    "\u20a6": "NGN",
    "\u00e2\u201a\u00a6": "NGN",
    "\u20ac": "EUR",
    "\u00e2\u201a\u00ac": "EUR",
}
MONTH_FORMATS = ("%d %b %Y", "%d %B %Y", "%B %d, %Y", "%b %d, %Y")


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
    return easyocr.Reader(settings.easyocr_languages, gpu=False, verbose=False)


def easyocr_version() -> str | None:
    try:
        return metadata.version("easyocr")
    except metadata.PackageNotFoundError:
        return None


def ensure_image_limits(image_path: Path) -> None:
    try:
        image_module = import_module("PIL.Image")
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pillow is not installed",
        ) from exc
    with image_module.open(image_path) as image:
        pixels = image.width * image.height
        if pixels > settings.ocr_image_max_pixels:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image is too large for OCR",
            )


def read_image_text(reader: Any, image_path: Path) -> list[dict[str, Any]]:
    ensure_image_limits(image_path)
    rows = reader.readtext(str(image_path), detail=1)
    lines: list[dict[str, Any]] = []
    for row in rows:
        if len(row) >= 3:
            confidence = quantize_money(Decimal(str(row[2])) * Decimal("100"))
            text = str(row[1])
            lines.append({"text": text, "confidence": confidence, "source_text": text})
    return lines


def average_confidence(lines: list[dict[str, Any]]) -> Decimal:
    if not lines:
        return Decimal("0.00")
    total = sum((line["confidence"] for line in lines), Decimal("0.00"))
    return quantize_money(total / Decimal(len(lines)))


def run_easyocr(path: Path, media_type: str) -> dict[str, Any]:
    reader = easyocr_reader()
    lines: list[dict[str, Any]] = []

    if media_type == "application/pdf":
        try:
            fitz = import_module("fitz")
        except ImportError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="PDF OCR renderer is not installed",
            ) from exc
        try:
            document = fitz.open(path)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="PDF is malformed or cannot be opened",
            ) from exc
        if document.needs_pass:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Encrypted PDFs are not supported for OCR",
            )
        with tempfile.TemporaryDirectory() as temp_dir:
            page_limit = min(document.page_count, settings.ocr_pdf_page_limit)
            scale = settings.ocr_pdf_render_dpi / 72
            matrix = fitz.Matrix(scale, scale)
            for page_index in range(page_limit):
                page = document.load_page(page_index)
                pixmap = page.get_pixmap(matrix=matrix)
                if pixmap.width * pixmap.height > settings.ocr_image_max_pixels:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Rendered PDF page is too large for OCR",
                    )
                image_path = Path(temp_dir) / f"page-{page_index}.png"
                pixmap.save(image_path)
                lines.extend(read_image_text(reader, image_path))
    else:
        lines = read_image_text(reader, path)

    raw_text = "\n".join(line["text"] for line in lines)
    return {
        "raw_text": raw_text,
        "confidence": average_confidence(lines),
        "lines": lines,
        "engine_name": "easyocr",
        "engine_version": easyocr_version(),
    }


def field_result(value: Any, confidence: Decimal, source_text: str | None) -> dict[str, Any]:
    return {
        "value": value,
        "confidence": confidence,
        "source_text": source_text,
        "uncertain": confidence < Decimal(settings.ocr_low_confidence_threshold),
    }


def line_confidence(lines: list[dict[str, Any]], source_text: str | None) -> Decimal:
    if source_text is None:
        return Decimal("0.00")
    for line in lines:
        if line["text"] == source_text:
            return line["confidence"]
    return Decimal("0.00")


def sourced_field(value: Any, lines: list[dict[str, Any]], source_text: str) -> dict[str, Any]:
    return field_result(value, line_confidence(lines, source_text), source_text)


def amount_candidates(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    marker = "|".join(
        sorted((re.escape(value) for value in CURRENCY_MARKERS), key=len, reverse=True)
    )
    marker = f"({marker})"
    amount = r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)"
    patterns = [rf"{marker}\s*{amount}", rf"{amount}\s*{marker}"]
    candidates: list[dict[str, Any]] = []
    for line in lines:
        text = line["text"]
        for pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                groups = match.groups()
                first = groups[0].upper() if groups[0].isalpha() else groups[0]
                if first in CURRENCY_MARKERS:
                    currency_marker = first
                    amount_text = groups[1]
                else:
                    amount_text = groups[0]
                    marker_text = groups[1]
                    currency_marker = marker_text.upper() if marker_text.isalpha() else marker_text
                currency = CURRENCY_MARKERS.get(currency_marker)
                if currency is None:
                    continue
                confidence = line["confidence"]
                if re.search(r"\b(total|paid|amount|payment|debit)\b", text, flags=re.IGNORECASE):
                    confidence = min(Decimal("100.00"), confidence + Decimal("5.00"))
                candidates.append(
                    {
                        "value": quantize_money(Decimal(amount_text.replace(",", ""))),
                        "currency": currency,
                        "confidence": quantize_money(confidence),
                        "source_text": text,
                    }
                )
    candidates.sort(key=lambda item: item["confidence"], reverse=True)
    return candidates


def choose_amount(candidates: list[dict[str, Any]]) -> tuple[Decimal | None, str | None]:
    if not candidates:
        return None, None
    top = candidates[0]
    threshold = Decimal(settings.ocr_low_confidence_threshold)
    if top["confidence"] < threshold:
        return None, None
    if len(candidates) > 1 and top["confidence"] - candidates[1]["confidence"] < Decimal("3.00"):
        return None, None
    return top["value"], top["currency"]


def parse_document_date(text: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    iso_match = re.search(r"\b(20[0-9]{2})-(0[1-9]|1[0-2])-([0-3][0-9])\b", text)
    if iso_match:
        value = date.fromisoformat(iso_match.group(0))
        return sourced_field(value.isoformat(), lines, iso_match.group(0))
    slash_match = re.search(r"\b([0-3]?[0-9])/([01]?[0-9])/(20[0-9]{2})\b", text)
    if slash_match:
        day, month, year = slash_match.groups()
        value = date(int(year), int(month), int(day))
        return sourced_field(value.isoformat(), lines, slash_match.group(0))
    for pattern in (
        r"\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+20[0-9]{2}\b",
        r"\b[A-Za-z]{3,9}\s+[0-3]?[0-9],\s+20[0-9]{2}\b",
    ):
        match = re.search(pattern, text)
        if match is None:
            continue
        for fmt in MONTH_FORMATS:
            try:
                value = datetime.strptime(match.group(0), fmt).date()
            except ValueError:
                continue
            return sourced_field(value.isoformat(), lines, match.group(0))
    return field_result(None, Decimal("0.00"), None)


def parse_document_time(text: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    match_24 = re.search(r"\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b", text)
    if match_24 is not None:
        hour, minute = match_24.groups()
        value = f"{int(hour):02d}:{minute}"
        return field_result(value, line_confidence(lines, match_24.group(0)), match_24.group(0))
    match_12 = re.search(r"\b(1[0-2]|0?[1-9]):([0-5][0-9])\s*([AP]M)\b", text, re.IGNORECASE)
    if match_12 is not None:
        hour_text, minute, meridiem = match_12.groups()
        hour = int(hour_text)
        if meridiem.upper() == "PM" and hour != 12:
            hour += 12
        if meridiem.upper() == "AM" and hour == 12:
            hour = 0
        return field_result(
            f"{hour:02d}:{minute}",
            line_confidence(lines, match_12.group(0)),
            match_12.group(0),
        )
    return field_result(None, Decimal("0.00"), None)


def parse_labeled_text(text: str, lines: list[dict[str, Any]], labels: str) -> dict[str, Any]:
    match = re.search(
        rf"\b(?:{labels})\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9 ._-]{{1,120}})",
        text,
        flags=re.IGNORECASE,
    )
    if match is None:
        return field_result(None, Decimal("0.00"), None)
    return sourced_field(match.group(1).strip(), lines, match.group(0))


def parse_extracted_fields(raw_text: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    candidates = amount_candidates(lines)
    amount, currency = choose_amount(candidates)
    amount_source = candidates[0]["source_text"] if candidates else None
    amount_confidence = candidates[0]["confidence"] if candidates else Decimal("0.00")
    return {
        "amount": field_result(
            str(amount) if amount is not None else None,
            amount_confidence,
            amount_source,
        ),
        "currency": field_result(currency, amount_confidence, amount_source),
        "transaction_date": parse_document_date(raw_text, lines),
        "transaction_time": parse_document_time(raw_text, lines),
        "reference": parse_labeled_text(raw_text, lines, "reference|ref|transaction|id"),
        "recipient": parse_labeled_text(raw_text, lines, "recipient|to|paid to|beneficiary"),
        "sender": parse_labeled_text(raw_text, lines, "sender|from|paid by"),
    }


def json_default(value: Any) -> str:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


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

    existing = db.scalar(
        select(OCRResult)
        .where(
            OCRResult.user_id == user.id,
            OCRResult.source_type == payload.source_type,
            OCRResult.source_id == payload.source_id,
            OCRResult.status.in_(ACTIVE_OCR_STATUSES),
        )
        .order_by(desc(OCRResult.created_at))
        .limit(1)
    )
    if existing is not None:
        logger.info(
            "OCR job create idempotent hit id=%s source_type=%s source_id=%s status=%s",
            existing.id,
            existing.source_type,
            existing.source_id,
            existing.status,
        )
        return existing

    result = OCRResult(
        user_id=user.id,
        source_type=payload.source_type,
        source_id=payload.source_id,
        confidence_score=Decimal("0.00"),
        status="pending",
        max_retries=settings.ocr_max_retries,
    )
    db.add(result)
    db.flush()
    create_audit_log(db, "ocr_job_create", user.id, request, {"ocr_result_id": result.id})
    db.commit()
    db.refresh(result)
    logger.info(
        "OCR job queued id=%s source_type=%s source_id=%s media_type=%s",
        result.id,
        result.source_type,
        result.source_id,
        media_type,
    )
    return result


def get_user_ocr_result(db: Session, user: User, result_id: str) -> OCRResult:
    result = db.get(OCRResult, result_id)
    if result is None or result.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR result not found")
    return result


def apply_extraction(result: OCRResult, extraction: dict[str, Any], duration_ms: int) -> None:
    raw_text = extraction["raw_text"]
    lines = extraction["lines"]
    candidates = amount_candidates(lines)
    fields = parse_extracted_fields(raw_text, lines)
    amount_value = fields["amount"]["value"]
    result.extracted_text = raw_text
    result.amount = Decimal(amount_value) if amount_value is not None else None
    result.currency = fields["currency"]["value"]
    result.document_date = (
        date.fromisoformat(fields["transaction_date"]["value"])
        if fields["transaction_date"]["value"]
        else None
    )
    result.document_time = fields["transaction_time"]["value"]
    result.reference = fields["reference"]["value"]
    result.recipient = fields["recipient"]["value"]
    result.sender = fields["sender"]["value"]
    result.confidence_score = extraction["confidence"]
    result.engine_name = extraction["engine_name"]
    result.engine_version = extraction["engine_version"]
    result.processing_duration_ms = duration_ms
    result.extracted_fields_json = json.dumps(fields, default=json_default, sort_keys=True)
    result.amount_candidates_json = json.dumps(candidates, default=json_default, sort_keys=True)
    result.failure_message = None
    result.status = "review_required"


def process_ocr_result(
    db: Session,
    result: OCRResult,
    request: Request | None = None,
) -> OCRResult:
    if result.status in {"pending", "failed"}:
        result = claim_ocr_result(db, result)
    elif result.status != "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="OCR result is not pending",
        )
    user = db.get(User, result.user_id)
    if user is None:
        result.status = "failed"
        result.failure_message = "User not found"
        db.commit()
        db.refresh(result)
        logger.error("OCR job failed id=%s reason=user_not_found", result.id)
        return result

    started = perf_counter()
    try:
        source_path, media_type = source_path_and_media_type(
            db,
            user,
            OCRJobCreate(
                source_type=cast(OCRSourceType, result.source_type),
                source_id=result.source_id,
            ),
        )
        if not source_path.exists():
            raise FileNotFoundError("Source file not found")
        extraction = run_easyocr(source_path, media_type)
        duration_ms = int((perf_counter() - started) * 1000)
        apply_extraction(result, extraction, duration_ms)
        artifact = ocr_artifact_path(result)
        artifact.parent.mkdir(parents=True, exist_ok=True)
        artifact.write_text(result.extracted_text or "", encoding="utf-8")
        notify_user(
            db,
            user,
            title="OCR review ready",
            message="A document was processed locally and is waiting for confirmation.",
            notification_type="ocr_review_pending",
            severity="info",
            related_type="ocr_result",
            related_id=result.id,
            deduplication_key=f"ocr_review_pending:{result.id}",
            request=request,
        )
        create_audit_log(db, "ocr_job_processed", user.id, request, {"ocr_result_id": result.id})
        logger.info(
            "OCR job completed id=%s status=%s confidence=%s duration_ms=%s",
            result.id,
            result.status,
            result.confidence_score,
            duration_ms,
        )
    except Exception as exc:
        result.status = "failed"
        result.failure_message = str(exc)[:1000]
        result.processing_duration_ms = int((perf_counter() - started) * 1000)
        create_audit_log(db, "ocr_job_failed", user.id, request, {"ocr_result_id": result.id})
        logger.exception(
            "OCR job failed id=%s source_type=%s source_id=%s",
            result.id,
            result.source_type,
            result.source_id,
        )
    db.commit()
    db.refresh(result)
    return result


def confirm_ocr_result(
    db: Session,
    user: User,
    result: OCRResult,
    payload: OCRResultConfirm,
    request: Request | None = None,
) -> OCRResult:
    if payload.status not in {"confirmed", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="OCR review can only be confirmed or cancelled from the review screen",
        )
    result.amount = payload.amount
    result.currency = payload.currency
    result.document_date = payload.document_date
    result.document_time = payload.document_time
    result.reference = payload.reference
    result.recipient = payload.recipient
    result.sender = payload.sender
    result.status = payload.status
    result.confirmed_at = datetime.now(UTC) if payload.status == "confirmed" else None
    create_audit_log(db, "ocr_result_confirm", user.id, request, {"ocr_result_id": result.id})
    db.commit()
    db.refresh(result)
    return result


def retry_ocr_result(
    db: Session,
    user: User,
    result: OCRResult,
    request: Request | None = None,
) -> OCRResult:
    if result.retry_count >= result.max_retries:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OCR retry limit reached")
    result.retry_count += 1
    result.status = "pending"
    result.failure_message = None
    create_audit_log(db, "ocr_job_retry", user.id, request, {"ocr_result_id": result.id})
    db.commit()
    db.refresh(result)
    logger.info(
        "OCR job retry queued id=%s retry_count=%s max_retries=%s",
        result.id,
        result.retry_count,
        result.max_retries,
    )
    return result


def cancel_ocr_result(
    db: Session,
    user: User,
    result: OCRResult,
    request: Request | None = None,
) -> OCRResult:
    if result.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Confirmed OCR results cannot be cancelled",
        )
    result.status = "cancelled"
    create_audit_log(db, "ocr_job_cancel", user.id, request, {"ocr_result_id": result.id})
    db.commit()
    db.refresh(result)
    return result


def decode_json(value: str | None, fallback: Any) -> Any:
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def ocr_to_read(result: OCRResult) -> OCRResultRead:
    return OCRResultRead.model_validate(result, from_attributes=True).model_copy(
        update={
            "extracted_fields": decode_json(result.extracted_fields_json, {}),
            "amount_candidates": decode_json(result.amount_candidates_json, []),
        }
    )


def list_ocr_results(
    db: Session,
    user: User,
    source_type: str | None,
    source_id: str | None,
    status_filter: str | None,
    limit: int,
    offset: int,
) -> OCRResultListRead:
    filters = [OCRResult.user_id == user.id]
    if source_type is not None:
        filters.append(OCRResult.source_type == source_type)
    if source_id is not None:
        filters.append(OCRResult.source_id == source_id)
    if status_filter is not None:
        filters.append(OCRResult.status == status_filter)
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


def next_pending_ocr_result(db: Session) -> OCRResult | None:
    return claim_next_pending_ocr_result(db)


def claim_ocr_result(db: Session, result: OCRResult) -> OCRResult:
    if result.status not in {"pending", "failed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="OCR result is not pending",
        )
    result.status = "processing"
    result.failure_message = None
    db.commit()
    db.refresh(result)
    logger.info(
        "OCR job claimed id=%s source_type=%s source_id=%s retry_count=%s",
        result.id,
        result.source_type,
        result.source_id,
        result.retry_count,
    )
    return result


def claim_next_pending_ocr_result(db: Session) -> OCRResult | None:
    query = (
        select(OCRResult)
        .where(OCRResult.status == "pending")
        .order_by(OCRResult.created_at)
        .limit(1)
    )
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)

    result = db.scalar(query)
    if result is None:
        return None
    return claim_ocr_result(db, result)


def recover_stale_processing_ocr_results(
    db: Session,
    timeout_seconds: int | None = None,
) -> int:
    timeout = timeout_seconds or settings.ocr_processing_timeout_seconds
    cutoff = datetime.now(UTC) - timedelta(seconds=timeout)
    stale_results = list(
        db.scalars(
            select(OCRResult)
            .where(
                OCRResult.status == "processing",
                OCRResult.updated_at < cutoff,
            )
            .order_by(OCRResult.updated_at)
        ).all()
    )
    for result in stale_results:
        if result.retry_count >= result.max_retries:
            result.status = "failed"
            result.failure_message = (
                result.failure_message
                or "OCR worker stopped while processing and retry limit was reached."
            )
            logger.error(
                "OCR stale processing job failed id=%s retry_count=%s max_retries=%s",
                result.id,
                result.retry_count,
                result.max_retries,
            )
            continue

        result.retry_count += 1
        result.status = "pending"
        result.failure_message = "OCR worker stopped while processing; job was requeued."
        logger.warning(
            "OCR stale processing job requeued id=%s retry_count=%s max_retries=%s",
            result.id,
            result.retry_count,
            result.max_retries,
        )

    if stale_results:
        db.commit()
    return len(stale_results)
