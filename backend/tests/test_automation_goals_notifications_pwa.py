from decimal import Decimal
from pathlib import Path

from conftest import csrf_headers, register_owner, user_payload
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ocr_result import OCRResult
from app.services.ocr import process_ocr_result

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"milestone-five" * 8


def money(value: str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def upload_receipt(client: TestClient, name: str = "automation.png") -> dict:
    response = client.post(
        "/api/v1/receipts",
        headers=csrf_headers(client),
        files={"receipt": (name, PNG_BYTES, "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_goals_contributions_notifications_and_timeline(client: TestClient) -> None:
    register_owner(client)

    goal_response = client.post(
        "/api/v1/goals",
        headers=csrf_headers(client),
        json={
            "name": "Portugal apartment deposit",
            "category": "house",
            "currency": "GBP",
            "target_amount": "10000.00",
            "starting_amount": "1000.00",
            "deadline": "2027-01-31",
            "priority": 1,
            "notes": "Deposit target",
            "is_primary": True,
        },
    )
    assert goal_response.status_code == 201, goal_response.text
    goal = goal_response.json()
    assert money(goal["progress_percentage"]) == money("10.00")

    contribution_response = client.post(
        f"/api/v1/goals/{goal['id']}/contributions",
        headers=csrf_headers(client),
        json={"amount": "250.00", "currency": "GBP", "notes": "Weekly allocation"},
    )
    assert contribution_response.status_code == 201, contribution_response.text

    updated_goal = client.get(f"/api/v1/goals/{goal['id']}").json()
    assert money(updated_goal["current_amount"]) == money("1250.00")
    assert money(updated_goal["progress_percentage"]) == money("12.50")

    contributions = client.get(f"/api/v1/goals/{goal['id']}/contributions")
    assert contributions.status_code == 200
    assert contributions.json()["total"] == 1

    wrong_currency = client.post(
        f"/api/v1/goals/{goal['id']}/contributions",
        headers=csrf_headers(client),
        json={"amount": "10.00", "currency": "USD"},
    )
    assert wrong_currency.status_code == 422

    notifications = client.get("/api/v1/notifications")
    assert notifications.status_code == 200
    assert notifications.json()["unread_count"] >= 2
    first_notification = notifications.json()["items"][0]

    read_response = client.patch(
        f"/api/v1/notifications/{first_notification['id']}/read",
        headers=csrf_headers(client),
    )
    assert read_response.status_code == 200
    assert read_response.json()["status"] == "read"

    timeline = client.get("/api/v1/timeline?limit=20")
    assert timeline.status_code == 200
    event_types = {item["event_type"] for item in timeline.json()["items"]}
    assert {"goal_created", "goal_contribution_added", "notification_sent"}.issubset(
        event_types
    )

    dashboard = client.get("/api/v1/dashboard/summary")
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["active_goals"][0]["id"] == goal["id"]
    assert body["recent_timeline"]


def test_local_ocr_review_workflow_updates_dashboard(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    register_owner(client)
    receipt = upload_receipt(client, "ocr-review.png")

    def fake_easyocr(path: Path, media_type: str) -> dict:
        assert path.exists()
        assert media_type == "image/png"
        return {
            "raw_text": "Amount GBP 45.67\nDate 2026-08-01\nTime 10:15\nReference OCR-123",
            "confidence": Decimal("88.25"),
            "lines": [
                {"text": "Amount GBP 45.67", "confidence": Decimal("92.00")},
                {"text": "Date 2026-08-01", "confidence": Decimal("88.00")},
                {"text": "Time 10:15", "confidence": Decimal("86.00")},
                {"text": "Reference OCR-123", "confidence": Decimal("87.00")},
            ],
            "engine_name": "easyocr",
            "engine_version": "test",
        }

    monkeypatch.setattr("app.services.ocr.run_easyocr", fake_easyocr)
    result = client.post(
        "/api/v1/ocr/jobs",
        headers=csrf_headers(client),
        json={"source_type": "receipt", "source_id": receipt["id"]},
    )
    assert result.status_code == 201, result.text
    assert result.json()["status"] == "pending"

    row = db_session.get(OCRResult, result.json()["id"])
    assert row is not None
    processed = process_ocr_result(db_session, row)
    assert processed.status == "review_required"

    pending = client.get("/api/v1/ocr/results?status=review_required")
    assert pending.status_code == 200
    assert pending.json()["total"] == 1
    assert list(Path(settings.ocr_storage_path).rglob("*.txt"))

    dashboard = client.get("/api/v1/dashboard/summary").json()
    assert dashboard["pending_ocr_reviews"] == 1
    assert dashboard["unread_notifications"] >= 1

    confirm = client.patch(
        f"/api/v1/ocr/results/{result.json()['id']}/confirm",
        headers=csrf_headers(client),
        json={
            "amount": "45.67",
            "currency": "GBP",
            "document_date": "2026-08-01",
            "document_time": "10:15",
            "reference": "OCR-123",
            "status": "confirmed",
        },
    )
    assert confirm.status_code == 200
    assert confirm.json()["confirmed_at"] is not None
    assert client.get("/api/v1/ocr/results?status=review_required").json()["total"] == 0


def test_backup_schedule_run_verify_and_permissions(
    client: TestClient,
    second_client: TestClient,
) -> None:
    register_owner(client)
    upload_receipt(client)

    jobs = client.get("/api/v1/automation/jobs")
    assert jobs.status_code == 200
    assert jobs.json()["items"][0]["job_type"] == "scheduled_backup"

    schedule = client.put(
        "/api/v1/automation/backups/schedule",
        headers=csrf_headers(client),
        json={"enabled": True, "cadence": "daily", "run_at_time": "03:15"},
    )
    assert schedule.status_code == 200, schedule.text
    assert schedule.json()["enabled"] is True
    assert schedule.json()["next_run_at"] is not None

    status_response = client.get("/api/v1/backups/status")
    assert status_response.status_code == 200
    assert status_response.json()["settings"]["enabled"] is True

    settings_response = client.patch(
        "/api/v1/backups/settings",
        headers=csrf_headers(client),
        json={"enabled": True, "frequency": "daily", "run_time": "03:15"},
    )
    assert settings_response.status_code == 200
    assert settings_response.json()["run_time"] == "03:15"

    dry_run = client.post(
        "/api/v1/backups/run",
        headers=csrf_headers(client),
        json={"trigger": "manual", "dry_run": True},
    )
    assert dry_run.status_code == 201
    assert dry_run.json()["status"] == "completed"
    assert dry_run.json()["backup_filename"] is None

    run = client.post(
        "/api/v1/automation/backups/run",
        headers=csrf_headers(client),
        json={"trigger": "manual"},
    )
    assert run.status_code == 201, run.text
    backup = run.json()
    assert backup["status"] == "completed"
    assert backup["restore_verified"] is True
    assert backup["sha256"]
    assert backup["backup_filename"] is not None
    assert "/" not in backup["backup_filename"]
    assert Path(settings.backup_storage_path, backup["backup_filename"]).exists()

    verify = client.post(
        f"/api/v1/automation/backups/{backup['id']}/verify",
        headers=csrf_headers(client),
    )
    assert verify.status_code == 200
    assert verify.json()["restore_verified"] is True

    api_verify = client.post(
        "/api/v1/backups/verify",
        headers=csrf_headers(client),
        json={"backup_id": backup["id"], "latest": False},
    )
    assert api_verify.status_code == 200
    assert api_verify.json()["restore_verified"] is True

    backups = client.get("/api/v1/automation/backups")
    assert backups.status_code == 200
    assert backups.json()["total"] == 2

    client.patch(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={"registration_enabled": True},
    )
    assert second_client.post("/api/v1/auth/register", json=user_payload()).status_code == 201
    assert second_client.get("/api/v1/automation/jobs").status_code == 403


def test_pwa_manifest_service_worker_and_offline_shell_exist() -> None:
    frontend_root = Path(__file__).resolve().parents[2] / "frontend"

    manifest = frontend_root / "public" / "manifest.webmanifest"
    service_worker = frontend_root / "public" / "sw.js"
    offline = frontend_root / "public" / "offline.html"
    icon = frontend_root / "public" / "icons" / "observer-wealth.svg"

    assert manifest.exists()
    assert service_worker.exists()
    assert offline.exists()
    assert icon.exists()
    assert "api/" in service_worker.read_text(encoding="utf-8")
    assert "standalone" in manifest.read_text(encoding="utf-8")
