from decimal import Decimal
from pathlib import Path

from conftest import csrf_headers, register_owner, user_payload
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ocr_result import OCRResult
from app.services.ocr import process_ocr_result

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"portfolio" * 8
PNG_BYTES_TWO = b"\x89PNG\r\n\x1a\n" + b"vault" * 12
PDF_BYTES = b"%PDF-1.4\n%vault\n" + b"0" * 64


def money(value: str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def asset_payload(**overrides) -> dict:
    payload = {
        "category": "cash",
        "asset_name": "Monzo",
        "currency": "GBP",
        "purchase_price": "1000.00",
        "current_value": "1200.00",
        "purchase_date": "2026-08-01",
        "institution": "Monzo",
        "reference": "MONZO-001",
        "notes": "Primary cash account",
        "status": "active",
    }
    payload.update(overrides)
    return payload


def create_asset(client: TestClient, **overrides) -> dict:
    response = client.post(
        "/api/v1/assets",
        headers=csrf_headers(client),
        json=asset_payload(**overrides),
    )
    assert response.status_code == 201, response.text
    return response.json()


def entry_payload(**overrides) -> dict:
    payload = {
        "entry_date": "2026-08-01",
        "income_source": "forex",
        "realised_profit": "1000.00",
        "currency": "GBP",
        "actual_savings": "500.00",
        "actual_business": "300.00",
        "actual_living": "200.00",
        "transfer_confirmed": True,
        "idempotency_key": "portfolio-entry",
    }
    payload.update(overrides)
    return payload


def create_entry(client: TestClient, **overrides) -> dict:
    response = client.post(
        "/api/v1/entries",
        headers=csrf_headers(client),
        json=entry_payload(**overrides),
    )
    assert response.status_code == 201, response.text
    return response.json()


def upload_receipt(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("monzo.png", PNG_BYTES_TWO, "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def upload_vault_document(
    client: TestClient,
    name: str = "land-deed.pdf",
    content: bytes = PDF_BYTES,
    media_type: str = "application/pdf",
    folder: str = "land_documents",
) -> dict:
    response = client.post(
        "/api/v1/vault/documents",
        headers=csrf_headers(client),
        data={"folder": folder, "tags": "osogbo, land", "notes": "Osogbo land deed"},
        files={"document": (name, content, media_type)},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_asset_crud_and_append_only_history(client: TestClient) -> None:
    register_owner(client)
    asset = create_asset(client)

    assert asset["document_count"] == 0
    history = client.get(f"/api/v1/assets/{asset['id']}/history")
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["previous_value"] is None
    assert money(history.json()["items"][0]["new_value"]) == money("1200.00")

    update = client.patch(
        f"/api/v1/assets/{asset['id']}",
        headers=csrf_headers(client),
        json={"current_value": "1500.00", "history_notes": "Manual balance update"},
    )
    assert update.status_code == 200
    assert money(update.json()["current_value"]) == money("1500.00")

    add_history = client.post(
        f"/api/v1/assets/{asset['id']}/history",
        headers=csrf_headers(client),
        json={"new_value": "1750.00", "valuation_date": "2026-08-02"},
    )
    assert add_history.status_code == 201

    history_after = client.get(f"/api/v1/assets/{asset['id']}/history").json()
    assert history_after["total"] == 3
    values = [money(item["new_value"]) for item in history_after["items"]]
    assert money("1750.00") in values
    assert money("1500.00") in values
    assert money("1200.00") in values

    archive = client.delete(f"/api/v1/assets/{asset['id']}", headers=csrf_headers(client))
    assert archive.status_code == 200
    archived = client.get(f"/api/v1/assets/{asset['id']}").json()
    assert archived["status"] == "archived"


def test_asset_currency_change_is_blocked_after_history_exists(client: TestClient) -> None:
    register_owner(client)
    asset = create_asset(client)

    response = client.patch(
        f"/api/v1/assets/{asset['id']}",
        headers=csrf_headers(client),
        json={"currency": "USD"},
    )

    assert response.status_code == 409


def test_asset_document_upload_uses_asset_storage_and_secure_metadata(client: TestClient) -> None:
    register_owner(client)
    asset = create_asset(client, category="property", asset_name="Osogbo Land")

    upload = client.post(
        f"/api/v1/assets/{asset['id']}/documents",
        headers=csrf_headers(client),
        data={"folder": "land_documents", "tags": "survey", "notes": "Survey document"},
        files={"document": ("survey.png", PNG_BYTES, "image/png")},
    )

    assert upload.status_code == 201, upload.text
    document = upload.json()
    assert document["asset_id"] == asset["id"]
    assert document["storage_area"] == "asset"
    assert document["encrypted_filename"] != "survey.png"
    assert "/" not in document["encrypted_filename"]
    assert document["sha256"] == document["checksum"]
    assert Path(settings.asset_storage_path).exists()

    asset_documents = client.get(f"/api/v1/assets/{asset['id']}/documents").json()
    assert asset_documents["total"] == 1
    assert client.get(f"/api/v1/assets/{asset['id']}").json()["document_count"] == 1


def test_vault_upload_preview_delete_duplicate_and_validation(client: TestClient) -> None:
    register_owner(client)
    document = upload_vault_document(client)

    assert document["folder"] == "land_documents"
    assert document["original_filename"] == "land-deed.pdf"
    assert document["media_type"] == "application/pdf"
    assert "/" not in document["encrypted_filename"]

    content = client.get(f"/api/v1/vault/documents/{document['id']}/content")
    assert content.status_code == 200
    assert content.content == PDF_BYTES

    duplicate = client.post(
        "/api/v1/vault/documents",
        headers=csrf_headers(client),
        data={"folder": "tax_documents"},
        files={"document": ("copy.pdf", PDF_BYTES, "application/pdf")},
    )
    assert duplicate.status_code == 409

    disguised = client.post(
        "/api/v1/vault/documents",
        headers=csrf_headers(client),
        data={"folder": "tax_documents"},
        files={"document": ("bad.png", b"not-png", "image/png")},
    )
    assert disguised.status_code == 415

    original_size = settings.vault_max_file_size_bytes
    settings.vault_max_file_size_bytes = 12
    oversized = client.post(
        "/api/v1/vault/documents",
        headers=csrf_headers(client),
        data={"folder": "tax_documents"},
        files={"document": ("big.pdf", PDF_BYTES, "application/pdf")},
    )
    settings.vault_max_file_size_bytes = original_size
    assert oversized.status_code == 413

    update = client.patch(
        f"/api/v1/vault/documents/{document['id']}",
        headers=csrf_headers(client),
        json={"folder": "certificates", "tags": "certificate", "notes": "Moved folder"},
    )
    assert update.status_code == 200
    assert update.json()["folder"] == "certificates"

    delete = client.delete(
        f"/api/v1/vault/documents/{document['id']}",
        headers=csrf_headers(client),
    )
    assert delete.status_code == 200
    assert client.get(f"/api/v1/vault/documents/{document['id']}").status_code == 404


def test_asset_vault_and_search_permissions(
    client: TestClient,
    second_client: TestClient,
) -> None:
    register_owner(client)
    enable = client.patch(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={"registration_enabled": True},
    )
    assert enable.status_code == 200
    asset = create_asset(client, asset_name="ObserverAI", institution="Companies House")
    document = upload_vault_document(
        client,
        name="observer-contract.pdf",
        folder="company_documents",
    )

    register_response = second_client.post("/api/v1/auth/register", json=user_payload())
    assert register_response.status_code == 201

    assert second_client.get(f"/api/v1/assets/{asset['id']}").status_code == 404
    assert second_client.get(f"/api/v1/vault/documents/{document['id']}").status_code == 404
    assert (
        second_client.get(f"/api/v1/vault/documents/{document['id']}/content").status_code
        == 404
    )
    assert second_client.get("/api/v1/search?q=ObserverAI").json()["assets"] == []


def test_global_search_finds_assets_receipts_and_vault_documents(client: TestClient) -> None:
    register_owner(client)
    create_asset(client, asset_name="Osogbo Land", institution="Survey Office")
    upload_receipt(client)
    upload_vault_document(client, name="osogbo-deed.pdf")

    asset_results = client.get("/api/v1/search?q=Survey").json()
    assert asset_results["assets"][0]["asset_name"] == "Osogbo Land"

    receipt_results = client.get("/api/v1/search?q=monzo").json()
    assert receipt_results["receipts"][0]["original_filename"] == "monzo.png"

    document_results = client.get("/api/v1/search?q=osogbo").json()
    assert document_results["vault_documents"][0]["original_filename"] == "osogbo-deed.pdf"


def test_ocr_pipeline_requires_review_and_confirmation(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    register_owner(client)
    document = upload_vault_document(client)

    def fake_easyocr(path: Path, media_type: str) -> dict:
        assert path.exists()
        assert media_type == "application/pdf"
        return {
            "raw_text": "Amount GBP 123.45\nDate 2026-08-01\nTime 14:25\nReference MONZO-ABC",
            "confidence": Decimal("91.50"),
            "lines": [
                {"text": "Amount GBP 123.45", "confidence": Decimal("94.00")},
                {"text": "Date 2026-08-01", "confidence": Decimal("91.00")},
                {"text": "Time 14:25", "confidence": Decimal("90.00")},
                {"text": "Reference MONZO-ABC", "confidence": Decimal("91.00")},
            ],
            "engine_name": "easyocr",
            "engine_version": "test",
        }

    monkeypatch.setattr("app.services.ocr.run_easyocr", fake_easyocr)
    ocr = client.post(
        "/api/v1/ocr/jobs",
        headers=csrf_headers(client),
        json={"source_type": "vault_document", "source_id": document["id"]},
    )

    assert ocr.status_code == 201, ocr.text
    queued = ocr.json()
    assert queued["status"] == "pending"

    row = db_session.get(OCRResult, queued["id"])
    assert row is not None
    processed = process_ocr_result(db_session, row)
    assert processed.status == "review_required"

    review = client.get(f"/api/v1/ocr/results/{queued['id']}")
    assert review.status_code == 200
    result = review.json()
    assert result["status"] == "review_required"
    assert money(result["amount"]) == money("123.45")
    assert result["currency"] == "GBP"
    assert result["document_date"] == "2026-08-01"
    assert result["document_time"] == "14:25"
    assert result["reference"] == "MONZO-ABC"
    assert result["extracted_fields"]["amount"]["value"] == "123.45"
    assert result["amount_candidates"][0]["currency"] == "GBP"
    assert list(Path(settings.ocr_storage_path).rglob("*.txt"))

    confirm = client.patch(
        f"/api/v1/ocr/results/{result['id']}/confirm",
        headers=csrf_headers(client),
        json={
            "amount": "125.00",
            "currency": "GBP",
            "document_date": "2026-08-01",
            "document_time": "14:30",
            "reference": "MONZO-CORRECTED",
            "status": "confirmed",
        },
    )
    assert confirm.status_code == 200
    assert confirm.json()["status"] == "confirmed"
    assert confirm.json()["confirmed_at"] is not None

    content = client.get(f"/api/v1/vault/documents/{document['id']}/content")
    assert content.content == PDF_BYTES


def test_portfolio_summary_dashboard_cards_and_recent_items(client: TestClient) -> None:
    register_owner(client)
    create_entry(client)
    receipt = upload_receipt(client)
    cash = create_asset(client, category="cash", asset_name="Lloyds", current_value="1000.00")
    investment = create_asset(
        client,
        category="investment",
        asset_name="Vanguard",
        current_value="2000.00",
        reference="VAN-001",
    )
    create_asset(
        client,
        category="property",
        asset_name="Portugal Apartment",
        currency="EUR",
        current_value="100000.00",
        purchase_price="90000.00",
    )

    portfolio = client.get("/api/v1/portfolio/summary")
    assert portfolio.status_code == 200
    summary = portfolio.json()
    assert money(summary["tracked_savings"]) == money("500.00")
    assert money(summary["cash"]) == money("1500.00")
    assert money(summary["investments"]) == money("2000.00")
    assert money(summary["total_assets"]) == money("3500.00")
    assert money(summary["property"]) == money("0.00")
    assert {"currency": "EUR", "total_value": "100000.00"} in summary["totals_by_currency"]
    recent_asset_ids = {asset["id"] for asset in summary["recent_assets"]}
    assert {cash["id"], investment["id"]}.issubset(recent_asset_ids)
    assert summary["recent_receipts"][0]["id"] == receipt["id"]
    assert summary["allocation"]
    assert summary["growth"]

    dashboard = client.get("/api/v1/dashboard/summary")
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert money(body["total_assets"]) == money("3500.00")
    assert money(body["cash"]) == money("1500.00")
    assert money(body["investments"]) == money("2000.00")
    assert body["recent_receipts"][0]["id"] == receipt["id"]
    assert body["recent_assets"]
