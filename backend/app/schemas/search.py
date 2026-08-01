from pydantic import BaseModel

from app.schemas.asset import AssetRead
from app.schemas.receipt import ReceiptRead
from app.schemas.vault import VaultDocumentRead


class SearchResultsRead(BaseModel):
    assets: list[AssetRead]
    receipts: list[ReceiptRead]
    vault_documents: list[VaultDocumentRead]
