from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.asset import normalize_text

VaultFolder = Literal[
    "receipts",
    "certificates",
    "passports",
    "land_documents",
    "company_documents",
    "tax_documents",
    "trading_statements",
    "insurance",
    "other",
]


class VaultDocumentUpdate(BaseModel):
    folder: VaultFolder | None = None
    tags: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("tags", "notes")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return normalize_text(value)


class VaultDocumentRead(BaseModel):
    id: str
    user_id: str
    asset_id: str | None
    folder: str
    storage_area: str
    original_filename: str
    encrypted_filename: str
    media_type: str
    file_size: int
    sha256: str
    checksum: str
    tags: str | None
    notes: str | None
    uploaded_at: datetime
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class VaultDocumentListRead(BaseModel):
    items: list[VaultDocumentRead]
    total: int
    limit: int
    offset: int


class VaultFolderSummaryRead(BaseModel):
    folder: str
    document_count: int
