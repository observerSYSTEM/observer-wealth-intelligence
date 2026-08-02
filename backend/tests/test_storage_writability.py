from decimal import Decimal
from pathlib import Path
from typing import Any

from conftest import csrf_headers, register_owner
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import configured_storage_paths, ensure_storage_paths_writable
from app.models.ocr_result import OCRResult
from app.services.ocr import process_ocr_result

RECEIPT_PNG = b"\x89PNG\r\n\x1a\n" + b"receipt-storage" * 8
ASSET_PNG = b"\x89PNG\r\n\x1a\n" + b"asset-storage" * 8
OCR_PNG = b"\x89PNG\r\n\x1a\n" + b"ocr-storage" * 8
VAULT_PDF = b"%PDF-1.4\n%vault-storage\n" + b"0" * 64


def test_configured_storage_roots_are_created_and_writable() -> None:
    paths = ensure_storage_paths_writable()

    assert set(paths) == {"receipts", "assets", "vault", "ocr", "backups"}
    for path in configured_storage_paths().values():
        assert path.exists()
        assert path.is_dir()


def test_receipt_upload_writes_to_receipt_storage(client: TestClient) -> None:
    register_owner(client)

    response = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("pi-receipt.png", RECEIPT_PNG, "image/png")},
    )

    assert response.status_code == 201, response.text
    assert list(Path(settings.receipt_storage_path).rglob("*.png"))


def test_asset_document_and_vault_uploads_write_to_storage(client: TestClient) -> None:
    register_owner(client)
    asset_response = client.post(
        "/api/v1/assets",
        headers=csrf_headers(client),
        json={
            "category": "property",
            "asset_name": "Osogbo Land",
            "currency": "GBP",
            "purchase_price": "1000.00",
            "current_value": "1200.00",
            "purchase_date": "2026-08-01",
            "institution": "Survey Office",
            "reference": "LAND-001",
            "status": "active",
        },
    )
    assert asset_response.status_code == 201, asset_response.text

    asset_upload = client.post(
        f"/api/v1/assets/{asset_response.json()['id']}/documents",
        headers=csrf_headers(client),
        data={"folder": "land_documents", "tags": "survey", "notes": "Pi write test"},
        files={"document": ("survey.png", ASSET_PNG, "image/png")},
    )
    vault_upload = client.post(
        "/api/v1/vault/documents",
        headers=csrf_headers(client),
        data={"folder": "tax_documents", "tags": "tax", "notes": "Pi write test"},
        files={"document": ("tax.pdf", VAULT_PDF, "application/pdf")},
    )

    assert asset_upload.status_code == 201, asset_upload.text
    assert vault_upload.status_code == 201, vault_upload.text
    assert list(Path(settings.asset_storage_path).rglob("*.png"))
    assert list(Path(settings.vault_storage_path).rglob("*.pdf"))


def test_ocr_processing_writes_artifact_storage(
    client: TestClient,
    db_session: Session,
    monkeypatch: Any,
) -> None:
    register_owner(client)
    receipt_response = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("ocr-storage.png", OCR_PNG, "image/png")},
    )
    assert receipt_response.status_code == 201, receipt_response.text

    def fake_easyocr(path: Path, media_type: str) -> dict[str, Any]:
        assert path.exists()
        assert media_type == "image/png"
        return {
            "raw_text": "Amount GBP 12.34\nDate 2026-08-01\nTime 09:15\nReference PI-OCR",
            "confidence": Decimal("91.00"),
            "lines": [
                {"text": "Amount GBP 12.34", "confidence": Decimal("92.00")},
                {"text": "Date 2026-08-01", "confidence": Decimal("91.00")},
                {"text": "Time 09:15", "confidence": Decimal("90.00")},
                {"text": "Reference PI-OCR", "confidence": Decimal("91.00")},
            ],
            "engine_name": "easyocr",
            "engine_version": "test",
        }

    monkeypatch.setattr("app.services.ocr.run_easyocr", fake_easyocr)
    job_response = client.post(
        "/api/v1/ocr/jobs",
        headers=csrf_headers(client),
        json={"source_type": "receipt", "source_id": receipt_response.json()["id"]},
    )
    assert job_response.status_code == 201, job_response.text

    row = db_session.get(OCRResult, job_response.json()["id"])
    assert row is not None
    process_ocr_result(db_session, row)

    assert list(Path(settings.ocr_storage_path).rglob("*.txt"))


def test_backup_run_writes_backup_storage(client: TestClient) -> None:
    register_owner(client)
    upload_response = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("backup-source.png", RECEIPT_PNG, "image/png")},
    )
    assert upload_response.status_code == 201, upload_response.text

    backup_response = client.post(
        "/api/v1/automation/backups/run",
        headers=csrf_headers(client),
        json={"trigger": "manual"},
    )

    assert backup_response.status_code == 201, backup_response.text
    backup_filename = backup_response.json()["backup_filename"]
    assert backup_filename is not None
    assert Path(settings.backup_storage_path, backup_filename).exists()
