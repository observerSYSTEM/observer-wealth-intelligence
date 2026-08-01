from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Observer Wealth Intelligence"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(default="development-secret-change-before-production", min_length=32)
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 900
    receipt_max_file_size_bytes: int = 10 * 1024 * 1024
    receipt_storage_path: str = "data/receipts"
    asset_storage_path: str = "data/assets"
    vault_storage_path: str = "data/vault"
    ocr_storage_path: str = "data/ocr"
    vault_max_file_size_bytes: int = 25 * 1024 * 1024
    easyocr_languages: list[str] = ["en"]
    database_url: str = (
        "postgresql+psycopg://observer:observer-local-password@localhost:5432/observer_wealth"
    )
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]
    access_cookie_name: str = "owi_access_token"
    refresh_cookie_name: str = "owi_refresh_token"
    csrf_cookie_name: str = "owi_csrf_token"
    cookie_secure: bool | None = None
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str, info):
        environment = info.data.get("environment")
        if environment == "production" and value == "development-secret-change-before-production":
            raise ValueError("SECRET_KEY must be changed for production")
        return value

    @property
    def secure_cookies(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
