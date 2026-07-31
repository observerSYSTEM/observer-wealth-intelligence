from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.config import settings
from app.db.base import Base
from app.main import app
from app.services.rate_limit import login_rate_limiter

SQLALCHEMY_DATABASE_URL = "sqlite+pysqlite://"


@pytest.fixture(autouse=True)
def receipt_storage(tmp_path: Path) -> Generator[None]:
    original_path = settings.receipt_storage_path
    original_size = settings.receipt_max_file_size_bytes
    settings.receipt_storage_path = str(tmp_path / "receipts")
    settings.receipt_max_file_size_bytes = 10 * 1024 * 1024
    try:
        yield
    finally:
        settings.receipt_storage_path = original_path
        settings.receipt_max_file_size_bytes = original_size


@pytest.fixture()
def db_session() -> Generator[Session]:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    login_rate_limiter.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    login_rate_limiter.clear()


@pytest.fixture()
def second_client(db_session: Session) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client


def csrf_headers(test_client: TestClient) -> dict[str, str]:
    csrf_token = test_client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token is not None
    return {"X-CSRF-Token": csrf_token}


def owner_payload(email: str = "Owner@Example.com") -> dict[str, str]:
    return {
        "email": email,
        "password": "StrongPass123!",
        "display_name": "Owner",
        "timezone": "Europe/London",
        "preferred_currency": "GBP",
    }


def user_payload(email: str = "user@example.com") -> dict[str, str]:
    return {
        "email": email,
        "password": "AnotherPass123!",
        "display_name": "User",
        "timezone": "Europe/London",
        "preferred_currency": "USD",
    }


def register_owner(test_client: TestClient) -> dict:
    response = test_client.post("/api/v1/auth/register", json=owner_payload())
    assert response.status_code == 201, response.text
    return response.json()
