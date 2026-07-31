from conftest import csrf_headers, owner_payload, register_owner, user_payload
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_settings import AppSettings
from app.models.audit_log import AuditLog
from app.models.refresh_session import RefreshSession
from app.models.user import User


def test_first_owner_registration_creates_owner_and_disables_registration(
    client: TestClient,
    db_session: Session,
) -> None:
    setup_response = client.get("/api/v1/auth/setup-status")
    assert setup_response.status_code == 200
    assert setup_response.json() == {"owner_exists": False, "registration_enabled": False}

    response = client.post("/api/v1/auth/register", json=owner_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "owner@example.com"
    assert body["user"]["role"] == "owner"
    assert body["user"]["timezone"] == "Europe/London"
    assert body["user"]["preferred_currency"] == "GBP"
    assert client.cookies.get(settings.access_cookie_name) is not None
    assert client.cookies.get(settings.refresh_cookie_name) is not None
    assert client.cookies.get(settings.csrf_cookie_name) is not None

    app_settings = db_session.get(AppSettings, 1)
    assert app_settings is not None
    assert app_settings.registration_enabled is False


def test_registration_disabled_after_owner_creation(client: TestClient) -> None:
    register_owner(client)

    response = client.post("/api/v1/auth/register", json=user_payload())

    assert response.status_code == 403
    assert response.json()["detail"] == "Registration is disabled"


def test_valid_login_sets_cookies(client: TestClient, second_client: TestClient) -> None:
    register_owner(client)
    client.post("/api/v1/auth/logout", headers=csrf_headers(client))

    response = second_client.post(
        "/api/v1/auth/login",
        json={"email": "OWNER@example.com", "password": "StrongPass123!"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "owner@example.com"
    assert second_client.cookies.get(settings.access_cookie_name) is not None
    assert second_client.cookies.get(settings.refresh_cookie_name) is not None


def test_invalid_password_uses_consistent_error(
    client: TestClient,
    second_client: TestClient,
) -> None:
    register_owner(client)

    response = second_client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "WrongPass123!"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_duplicate_email_registration_is_rejected(
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

    response = second_client.post("/api/v1/auth/register", json=owner_payload("OWNER@example.com"))

    assert response.status_code == 409


def test_token_refresh_rotates_refresh_session(client: TestClient, db_session: Session) -> None:
    register_owner(client)
    old_refresh_token = client.cookies.get(settings.refresh_cookie_name)
    old_csrf_token = client.cookies.get(settings.csrf_cookie_name)

    response = client.post("/api/v1/auth/refresh", headers=csrf_headers(client))

    assert response.status_code == 200
    assert client.cookies.get(settings.refresh_cookie_name) != old_refresh_token
    assert client.cookies.get(settings.csrf_cookie_name) != old_csrf_token
    sessions = db_session.scalars(select(RefreshSession)).all()
    assert len(sessions) == 2
    assert sum(session.revoked_at is not None for session in sessions) == 1


def test_refresh_token_reuse_revokes_active_sessions(
    client: TestClient,
    second_client: TestClient,
) -> None:
    register_owner(client)
    old_refresh_token = client.cookies.get(settings.refresh_cookie_name)
    old_csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert old_refresh_token is not None
    assert old_csrf_token is not None

    first_refresh = client.post("/api/v1/auth/refresh", headers=csrf_headers(client))
    assert first_refresh.status_code == 200
    new_csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert new_csrf_token is not None

    second_client.cookies.set(settings.refresh_cookie_name, old_refresh_token)
    second_client.cookies.set(settings.csrf_cookie_name, old_csrf_token)
    reuse_response = second_client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": old_csrf_token},
    )
    assert reuse_response.status_code == 401

    revoked_response = client.post(
        "/api/v1/auth/refresh",
        headers={"X-CSRF-Token": new_csrf_token},
    )
    assert revoked_response.status_code == 401


def test_protected_endpoint_requires_authentication(second_client: TestClient) -> None:
    response = second_client.get("/api/v1/users/me")

    assert response.status_code == 401


def test_profile_update(client: TestClient) -> None:
    register_owner(client)

    response = client.patch(
        "/api/v1/users/me",
        headers=csrf_headers(client),
        json={
            "display_name": "Debbie",
            "timezone": "Europe/London",
            "preferred_currency": "NGN",
        },
    )

    assert response.status_code == 200
    assert response.json()["display_name"] == "Debbie"
    assert response.json()["preferred_currency"] == "NGN"


def test_email_change_requires_password_confirmation(client: TestClient) -> None:
    register_owner(client)

    missing_password = client.patch(
        "/api/v1/users/me",
        headers=csrf_headers(client),
        json={"email": "new@example.com"},
    )
    assert missing_password.status_code == 422

    response = client.patch(
        "/api/v1/users/me",
        headers=csrf_headers(client),
        json={
            "email": "NEW@example.com",
            "password_confirmation": "StrongPass123!",
        },
    )

    assert response.status_code == 200
    assert response.json()["email"] == "new@example.com"


def test_password_change_revokes_sessions(
    client: TestClient,
    second_client: TestClient,
) -> None:
    register_owner(client)

    response = client.put(
        "/api/v1/users/me/password",
        headers=csrf_headers(client),
        json={
            "current_password": "StrongPass123!",
            "new_password": "BetterPass123!",
        },
    )

    assert response.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401

    old_login = second_client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123!"},
    )
    assert old_login.status_code == 401

    new_login = second_client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "BetterPass123!"},
    )
    assert new_login.status_code == 200


def test_allocation_validation(client: TestClient) -> None:
    register_owner(client)

    response = client.patch(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={
            "savings_percentage": 40,
            "business_percentage": 30,
            "living_percentage": 20,
        },
    )

    assert response.status_code == 422


def test_unauthenticated_settings_access(second_client: TestClient) -> None:
    response = second_client.get("/api/v1/settings")

    assert response.status_code == 401


def test_owner_only_settings_changes(client: TestClient, second_client: TestClient) -> None:
    register_owner(client)
    response = client.patch(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={"registration_enabled": True},
    )
    assert response.status_code == 200

    user_response = second_client.post("/api/v1/auth/register", json=user_payload())
    assert user_response.status_code == 201
    assert user_response.json()["user"]["role"] == "user"

    settings_response = second_client.patch(
        "/api/v1/settings",
        headers=csrf_headers(second_client),
        json={"registration_enabled": False},
    )

    assert settings_response.status_code == 403


def test_audit_logging_for_security_events(client: TestClient, db_session: Session) -> None:
    register_owner(client)
    logout_response = client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    assert logout_response.status_code == 200
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123!"},
    )
    assert login_response.status_code == 200
    client.patch(
        "/api/v1/settings",
        headers=csrf_headers(client),
        json={"primary_goal_amount": "120000.00"},
    )
    client.put(
        "/api/v1/users/me/password",
        headers=csrf_headers(client),
        json={
            "current_password": "StrongPass123!",
            "new_password": "BetterPass123!",
        },
    )

    actions = [row[0] for row in db_session.execute(select(User.email)).all()]
    assert actions == ["owner@example.com"]

    audit_actions = [row[0] for row in db_session.execute(select(AuditLog.action)).all()]
    assert "first_owner_registration" in audit_actions
    assert "logout" in audit_actions
    assert "login" in audit_actions
    assert "settings_change" in audit_actions
    assert "password_change" in audit_actions
