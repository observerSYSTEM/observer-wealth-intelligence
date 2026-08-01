from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class TimelineEventRead(BaseModel):
    id: str
    user_id: str
    event_type: str
    title: str
    summary: str | None
    occurred_at: datetime
    amount: Decimal | None
    currency: str | None
    entity_type: str
    entity_id: str
    status: str | None
    metadata: dict[str, Any]
    created_at: datetime


class TimelineListRead(BaseModel):
    items: list[TimelineEventRead]
    total: int
    limit: int
    offset: int
