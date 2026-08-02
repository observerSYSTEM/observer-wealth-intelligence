from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from conftest import csrf_headers, register_owner
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ocr_result import OCRResult
from app.models.receipt import Receipt
from app.services.receipts import receipt_file_path
from app.workers import ocr_worker

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"ocr-worker" * 8


class WorkerSessionProxy:
    def __init__(self, session: Session) -> None:
        self._session = session

    def __getattr__(self, name: str) -> Any:
        return getattr(self._session, name)

    def close(self) -> None:
        return None


def patch_worker_session(monkeypatch, db_session: Session) -> None:
    monkeypatch.setattr(ocr_worker, "SessionLocal", lambda: WorkerSessionProxy(db_session))


def fake_easyocr(path: Path, media_type: str) -> dict[str, Any]:
    assert path.exists()
    assert media_type == "image/png"
    return {
        "raw_text": "Total GBP 45.67\nDate 2026-08-02\nTime 09:15\nReference OCR-PI-1",
        "confidence": Decimal("91.00"),
        "lines": [
            {"text": "Total GBP 45.67", "confidence": Decimal("95.00")},
            {"text": "Date 2026-08-02", "confidence": Decimal("90.00")},
            {"text": "Time 09:15", "confidence": Decimal("89.00")},
            {"text": "Reference OCR-PI-1", "confidence": Decimal("90.00")},
        ],
        "engine_name": "easyocr",
        "engine_version": "test",
    }


def upload_receipt(client: TestClient, name: str = "worker.png") -> dict:
    response = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": (name, PNG_BYTES, "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_ocr_job(client: TestClient, receipt_id: str) -> dict:
    response = client.post(
        "/api/v1/ocr/jobs",
        headers=csrf_headers(client),
        json={"source_type": "receipt", "source_id": receipt_id},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_worker_picks_up_receipt_ocr_job_and_persists_review(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    register_owner(client)
    receipt = upload_receipt(client)
    queued = create_ocr_job(client, receipt["id"])
    assert queued["status"] == "pending"

    monkeypatch.setattr("app.services.ocr.run_easyocr", fake_easyocr)
    patch_worker_session(monkeypatch, db_session)

    assert ocr_worker.run_once() is True

    stored = db_session.get(OCRResult, queued["id"])
    assert stored is not None
    assert stored.status == "review_required"
    assert stored.amount == Decimal("45.67")
    assert stored.currency == "GBP"
    assert stored.reference == "OCR-PI-1"
    assert stored.engine_name == "easyocr"
    assert stored.processing_duration_ms is not None
    assert list(Path(settings.ocr_storage_path).rglob("*.txt"))

    review = client.get(f"/api/v1/ocr/results/{queued['id']}")
    assert review.status_code == 200, review.text
    assert review.json()["status"] == "review_required"


def test_worker_marks_missing_receipt_file_as_failed(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    register_owner(client)
    receipt = upload_receipt(client, "missing-source.png")
    queued = create_ocr_job(client, receipt["id"])
    stored_receipt = db_session.get(Receipt, receipt["id"])
    assert stored_receipt is not None
    receipt_file_path(stored_receipt).unlink()

    patch_worker_session(monkeypatch, db_session)

    assert ocr_worker.run_once() is True

    stored = db_session.get(OCRResult, queued["id"])
    assert stored is not None
    assert stored.status == "failed"
    assert "Source file not found" in (stored.failure_message or "")


def test_worker_startup_recovers_stale_processing_job(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    register_owner(client)
    receipt = upload_receipt(client, "recovery.png")
    queued = create_ocr_job(client, receipt["id"])
    stored = db_session.get(OCRResult, queued["id"])
    assert stored is not None
    stored.status = "processing"
    stored.updated_at = datetime.now(UTC) - timedelta(hours=2)
    db_session.commit()

    monkeypatch.setattr("app.services.ocr.run_easyocr", fake_easyocr)
    patch_worker_session(monkeypatch, db_session)

    assert ocr_worker.recover_processing_jobs() == 1
    db_session.refresh(stored)
    assert stored.status == "pending"
    assert stored.retry_count == 1

    assert ocr_worker.run_once() is True
    db_session.refresh(stored)
    assert stored.status == "review_required"


def test_duplicate_active_ocr_request_is_idempotent(
    client: TestClient,
    db_session: Session,
) -> None:
    register_owner(client)
    receipt = upload_receipt(client, "duplicate.png")

    first = create_ocr_job(client, receipt["id"])
    second = create_ocr_job(client, receipt["id"])

    assert second["id"] == first["id"]
    active_count = db_session.scalar(
        select(func.count())
        .select_from(OCRResult)
        .where(
            OCRResult.source_type == "receipt",
            OCRResult.source_id == receipt["id"],
            OCRResult.status.in_(["pending", "processing", "review_required"]),
        )
    )
    assert active_count == 1
