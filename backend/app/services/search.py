from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.models.receipt import Receipt
from app.models.user import User
from app.models.vault_document import VaultDocument
from app.schemas.search import SearchResultsRead
from app.services.assets import asset_to_read
from app.services.receipts import receipt_to_read
from app.services.vault import document_to_read


def global_search(db: Session, user: User, query: str, limit: int) -> SearchResultsRead:
    pattern = f"%{query.strip()}%"
    assets = list(
        db.scalars(
            select(Asset)
            .where(
                Asset.user_id == user.id,
                or_(
                    Asset.asset_name.ilike(pattern),
                    Asset.institution.ilike(pattern),
                    Asset.reference.ilike(pattern),
                    Asset.notes.ilike(pattern),
                ),
            )
            .order_by(desc(Asset.updated_at))
            .limit(limit)
        ).all()
    )
    receipts = list(
        db.scalars(
            select(Receipt)
            .where(
                Receipt.user_id == user.id,
                Receipt.deleted_at.is_(None),
                Receipt.original_filename.ilike(pattern),
            )
            .order_by(desc(Receipt.uploaded_at))
            .limit(limit)
        ).all()
    )
    documents = list(
        db.scalars(
            select(VaultDocument)
            .where(
                VaultDocument.user_id == user.id,
                VaultDocument.deleted_at.is_(None),
                or_(
                    VaultDocument.original_filename.ilike(pattern),
                    VaultDocument.tags.ilike(pattern),
                    VaultDocument.notes.ilike(pattern),
                    VaultDocument.folder.ilike(pattern),
                ),
            )
            .order_by(desc(VaultDocument.uploaded_at))
            .limit(limit)
        ).all()
    )
    return SearchResultsRead(
        assets=[asset_to_read(db, asset) for asset in assets],
        receipts=[receipt_to_read(db, receipt) for receipt in receipts],
        vault_documents=[document_to_read(document) for document in documents],
    )
