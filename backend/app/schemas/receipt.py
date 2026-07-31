from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReceiptRead(BaseModel):
    id: str
    user_id: str
    original_filename: str
    media_type: str
    file_size: int
    storage_backend: str
    uploaded_at: datetime
    deleted_at: datetime | None
    linked_entry_id: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ReceiptListRead(BaseModel):
    items: list[ReceiptRead]
    total: int
    limit: int
    offset: int
