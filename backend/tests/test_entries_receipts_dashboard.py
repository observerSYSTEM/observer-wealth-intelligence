from datetime import UTC, datetime, timedelta
from decimal import Decimal

from conftest import csrf_headers, register_owner, user_payload
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.receipt import Receipt
from app.models.wealth_entry import WealthEntry
from app.services.entries import calculate_discipline_score

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 64
PDF_BYTES = b"%PDF-1.4\n%test\n" + b"0" * 64


def money(value: str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def entry_payload(**overrides) -> dict:
    payload = {
        "entry_date": "2026-07-31",
        "income_source": "forex",
        "realised_profit": "300.00",
        "currency": "GBP",
        "actual_savings": "150.00",
        "actual_business": "90.00",
        "actual_living": "60.00",
        "transfer_confirmed": True,
        "notes": "Monzo transfer confirmed",
        "idempotency_key": "entry-key-001",
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


def upload_png(client: TestClient, name: str = "receipt.png", content: bytes = PNG_BYTES) -> dict:
    response = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": (name, content, "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_profit_allocation_for_300_gbp(client: TestClient) -> None:
    register_owner(client)

    entry = create_entry(client)

    assert money(entry["recommended_savings"]) == money("150.00")
    assert money(entry["recommended_business"]) == money("90.00")
    assert money(entry["recommended_living"]) == money("60.00")
    assert entry["status"] == "target_met"
    assert entry["discipline_score"] == 100


def test_changed_allocation_percentages(client: TestClient) -> None:
    register_owner(client)
    settings_response = client.patch(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={
            "savings_percentage": 60,
            "business_percentage": 20,
            "living_percentage": 20,
        },
    )
    assert settings_response.status_code == 200

    entry = create_entry(client, idempotency_key="changed-allocation")

    assert entry["savings_percentage"] == 60
    assert money(entry["recommended_savings"]) == money("180.00")
    assert money(entry["recommended_business"]) == money("60.00")
    assert money(entry["recommended_living"]) == money("60.00")


def test_decimal_rounding(client: TestClient) -> None:
    register_owner(client)

    entry = create_entry(
        client,
        realised_profit="100.005",
        actual_savings="50.005",
        idempotency_key="rounding-key",
    )

    assert money(entry["realised_profit"]) == money("100.01")
    assert money(entry["recommended_savings"]) == money("50.01")
    assert money(entry["actual_savings"]) == money("50.01")


def test_above_and_below_target_savings(client: TestClient) -> None:
    register_owner(client)

    above = create_entry(client, actual_savings="250.00", idempotency_key="above-key")
    below = create_entry(
        client,
        entry_date="2026-08-01",
        actual_savings="80.00",
        future_confirmed=True,
        idempotency_key="below-key",
    )

    assert above["status"] == "above_target"
    assert money(above["savings_variance"]) == money("100.00")
    assert below["status"] == "below_target"
    assert money(below["savings_variance"]) == money("-70.00")


def test_zero_and_negative_profit_entries_do_not_require_savings(client: TestClient) -> None:
    register_owner(client)

    zero = create_entry(
        client,
        realised_profit="0.00",
        actual_savings="0.00",
        idempotency_key="zero",
    )
    negative = create_entry(
        client,
        realised_profit="-50.00",
        actual_savings="0.00",
        idempotency_key="negative",
        duplicate_confirmed=True,
    )

    assert zero["status"] == "no_savings_required"
    assert zero["discipline_score"] is None
    assert money(zero["recommended_savings"]) == money("0.00")
    assert negative["status"] == "no_savings_required"
    assert negative["discipline_score"] is None


def test_discipline_score_boundaries() -> None:
    recommended = Decimal("100.00")

    assert calculate_discipline_score(recommended, Decimal("100.00")) == ("target_met", 100)
    assert calculate_discipline_score(recommended, Decimal("80.00")) == ("below_target", 80)
    assert calculate_discipline_score(recommended, Decimal("50.00")) == ("below_target", 50)
    assert calculate_discipline_score(recommended, Decimal("0.01")) == ("below_target", 25)
    assert calculate_discipline_score(recommended, Decimal("0.00")) == ("below_target", 0)
    assert calculate_discipline_score(Decimal("0.00"), Decimal("0.00")) == (
        "no_savings_required",
        None,
    )


def test_multiple_entries_per_day_duplicate_warning_and_confirmation(client: TestClient) -> None:
    register_owner(client)
    create_entry(client, idempotency_key="first-forex")

    duplicate = client.post(
        "/api/v1/entries",
        headers=csrf_headers(client),
        json=entry_payload(idempotency_key="second-forex"),
    )
    assert duplicate.status_code == 409

    confirmed = create_entry(
        client,
        duplicate_confirmed=True,
        idempotency_key="second-forex",
    )
    assert confirmed["income_source"] == "forex"


def test_idempotent_create_request(client: TestClient) -> None:
    register_owner(client)

    first = create_entry(client, idempotency_key="same-submit")
    second = create_entry(client, idempotency_key="same-submit", actual_savings="250.00")

    assert second["id"] == first["id"]
    assert money(second["actual_savings"]) == money("150.00")


def test_create_entry_requires_idempotency_key(client: TestClient) -> None:
    register_owner(client)
    payload = entry_payload()
    payload.pop("idempotency_key")

    response = client.post("/api/v1/entries", headers=csrf_headers(client), json=payload)

    assert response.status_code == 422


def test_receipt_upload_security_duplicate_and_download(
    client: TestClient,
    db_session: Session,
) -> None:
    register_owner(client)

    receipt = upload_png(client, "monzo.png")

    assert receipt["original_filename"] == "monzo.png"
    assert receipt["media_type"] == "image/png"
    assert "stored_filename" not in receipt
    stored = db_session.get(Receipt, receipt["id"])
    assert stored is not None
    assert not stored.stored_filename.startswith("monzo")

    duplicate = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("another.png", PNG_BYTES, "image/png")},
    )
    assert duplicate.status_code == 409

    download = client.get(f"/api/v1/receipts/{receipt['id']}/content")
    assert download.status_code == 200
    assert download.content == PNG_BYTES


def test_receipt_rejects_unsupported_disguised_and_oversized_files(client: TestClient) -> None:
    register_owner(client)

    unsupported = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("script.exe", b"MZ", "application/octet-stream")},
    )
    assert unsupported.status_code == 415

    disguised = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("fake.png", b"not-a-png", "image/png")},
    )
    assert disguised.status_code == 415

    settings.receipt_max_file_size_bytes = 16
    oversized = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": ("big.pdf", PDF_BYTES, "application/pdf")},
    )
    assert oversized.status_code == 413


def test_entry_receipt_attachment_and_detach_on_receipt_delete(
    client: TestClient,
    db_session: Session,
) -> None:
    register_owner(client)
    receipt = upload_png(client)

    entry = create_entry(client, receipt_id=receipt["id"], idempotency_key="attached")
    assert entry["receipt_id"] == receipt["id"]

    delete_response = client.delete(
        f"/api/v1/receipts/{receipt['id']}",
        headers=csrf_headers(client),
    )
    assert delete_response.status_code == 200
    db_session.expire_all()
    stored_entry = db_session.get(WealthEntry, entry["id"])
    assert stored_entry is not None
    assert stored_entry.receipt_id is None


def test_user_ownership_isolation_for_entries_and_receipts(
    client: TestClient,
    second_client: TestClient,
) -> None:
    register_owner(client)
    settings_response = client.patch(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={"registration_enabled": True},
    )
    assert settings_response.status_code == 200
    entry = create_entry(client, idempotency_key="owner-entry")
    receipt = upload_png(client)

    register_response = second_client.post("/api/v1/auth/register", json=user_payload())
    assert register_response.status_code == 201

    assert second_client.get(f"/api/v1/entries/{entry['id']}").status_code == 404
    assert second_client.get(f"/api/v1/receipts/{receipt['id']}").status_code == 404
    assert second_client.get(f"/api/v1/receipts/{receipt['id']}/content").status_code == 404


def test_dashboard_totals_goal_currency_and_charts(client: TestClient) -> None:
    register_owner(client)
    create_entry(client, actual_savings="250.00", idempotency_key="gbp-one")
    create_entry(
        client,
        currency="USD",
        actual_savings="500.00",
        duplicate_confirmed=True,
        idempotency_key="usd-one",
    )

    response = client.get("/api/v1/dashboard/summary")

    assert response.status_code == 200
    summary = response.json()
    assert money(summary["tracked_savings"]) == money("250.00")
    assert summary["tracked_savings_currency"] == "GBP"
    assert money(summary["goal_progress_percentage"]) == money("0.25")
    assert summary["savings_by_currency"] == [
        {"currency": "GBP", "total_actual_savings": "250.00"},
        {"currency": "USD", "total_actual_savings": "500.00"},
    ]
    assert len(summary["latest_entries"]) == 2
    assert summary["daily_savings"]
    assert summary["monthly_savings"]


def test_streak_rules_ignore_losing_days_and_break_on_below_target(client: TestClient) -> None:
    register_owner(client)
    create_entry(client, entry_date="2026-07-28", actual_savings="150.00", idempotency_key="d1")
    create_entry(
        client,
        entry_date="2026-07-29",
        realised_profit="-10.00",
        actual_savings="0.00",
        duplicate_confirmed=True,
        idempotency_key="d2",
    )
    create_entry(client, entry_date="2026-07-30", actual_savings="160.00", idempotency_key="d3")
    create_entry(client, entry_date="2026-07-31", actual_savings="70.00", idempotency_key="d4")

    summary = client.get("/api/v1/dashboard/summary").json()

    assert summary["current_streak"] == 0
    assert summary["longest_streak"] == 2


def test_utc_recording_and_timezone_display(client: TestClient, db_session: Session) -> None:
    register_owner(client)
    entry = create_entry(client, idempotency_key="tz-entry")

    stored = db_session.get(WealthEntry, entry["id"])
    assert stored is not None
    assert stored.timezone == "Europe/London"
    assert stored.recorded_at <= datetime.now(UTC).replace(tzinfo=None) + timedelta(seconds=5)
    assert entry["recorded_at_local"].endswith("+01:00")


def test_entry_update_recalculates_and_delete_keeps_receipt_metadata(
    client: TestClient,
    db_session: Session,
) -> None:
    register_owner(client)
    receipt = upload_png(client)
    entry = create_entry(client, receipt_id=receipt["id"], idempotency_key="update-entry")

    update = client.patch(
        f"/api/v1/entries/{entry['id']}",
        headers=csrf_headers(client),
        json={"actual_savings": "80.00"},
    )
    assert update.status_code == 200
    assert money(update.json()["savings_variance"]) == money("-70.00")
    assert update.json()["status"] == "below_target"

    delete_response = client.delete(f"/api/v1/entries/{entry['id']}", headers=csrf_headers(client))
    assert delete_response.status_code == 200
    assert db_session.get(WealthEntry, entry["id"]) is None
    assert db_session.get(Receipt, receipt["id"]) is not None


def test_listing_filters_and_pagination(client: TestClient) -> None:
    register_owner(client)
    create_entry(client, entry_date="2026-07-30", idempotency_key="list-one")
    create_entry(
        client,
        entry_date="2026-07-31",
        income_source="business",
        currency="NGN",
        idempotency_key="list-two",
    )

    response = client.get("/api/v1/entries?currency=NGN&limit=1&offset=0")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["currency"] == "NGN"
