from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status

from app.core.config import settings


class LoginRateLimiter:
    def __init__(self) -> None:
        self._attempts: dict[str, deque[datetime]] = defaultdict(deque)

    def ensure_allowed(self, key: str) -> None:
        now = datetime.now(UTC)
        window_started_at = now - timedelta(seconds=settings.login_rate_limit_window_seconds)
        attempts = self._attempts[key]
        while attempts and attempts[0] < window_started_at:
            attempts.popleft()

        if len(attempts) >= settings.login_rate_limit_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Try again later.",
            )

    def record_failure(self, key: str) -> None:
        self._attempts[key].append(datetime.now(UTC))

    def record_success(self, key: str) -> None:
        self._attempts.pop(key, None)

    def clear(self) -> None:
        self._attempts.clear()


login_rate_limiter = LoginRateLimiter()
