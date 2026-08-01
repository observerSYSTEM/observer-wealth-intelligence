from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.asset import (
    AssetCreate,
    AssetHistoryListRead,
    AssetListRead,
    AssetRead,
    AssetUpdate,
    AssetValueHistoryCreate,
    AssetValueHistoryRead,
)
from app.schemas.common import MessageRead
from app.schemas.vault import VaultDocumentListRead, VaultDocumentRead
from app.services.assets import (
    add_value_history,
    asset_to_read,
    create_asset,
    delete_asset,
    get_user_asset,
    list_asset_history,
    list_assets,
    update_asset,
)
from app.services.vault import document_to_read, list_documents, upload_document

router = APIRouter()


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
def create_user_asset(
    payload: AssetCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> AssetRead:
    asset = create_asset(db, current_user, payload, request)
    return asset_to_read(db, asset)


@router.get("", response_model=AssetListRead)
def read_assets(
    category: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetListRead:
    return list_assets(db, current_user, category, status_filter, search, limit, offset)


@router.get("/{asset_id}", response_model=AssetRead)
def read_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetRead:
    return asset_to_read(db, get_user_asset(db, current_user, asset_id))


@router.patch("/{asset_id}", response_model=AssetRead)
def update_user_asset(
    asset_id: str,
    payload: AssetUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> AssetRead:
    asset = get_user_asset(db, current_user, asset_id)
    return asset_to_read(db, update_asset(db, current_user, asset, payload, request))


@router.delete("/{asset_id}", response_model=MessageRead)
def archive_user_asset(
    asset_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    delete_asset(db, current_user, get_user_asset(db, current_user, asset_id), request)
    return MessageRead(message="Asset archived")


@router.get("/{asset_id}/history", response_model=AssetHistoryListRead)
def read_asset_history(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetHistoryListRead:
    return list_asset_history(db, current_user, get_user_asset(db, current_user, asset_id))


@router.post(
    "/{asset_id}/history",
    response_model=AssetValueHistoryRead,
    status_code=status.HTTP_201_CREATED,
)
def add_asset_history(
    asset_id: str,
    payload: AssetValueHistoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> AssetValueHistoryRead:
    asset = get_user_asset(db, current_user, asset_id)
    history = add_value_history(db, current_user, asset, payload, request)
    return AssetValueHistoryRead.model_validate(history, from_attributes=True)


@router.get("/{asset_id}/documents", response_model=VaultDocumentListRead)
def read_asset_documents(
    asset_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VaultDocumentListRead:
    get_user_asset(db, current_user, asset_id)
    return list_documents(db, current_user, None, None, limit, offset, asset_id=asset_id)


@router.post(
    "/{asset_id}/documents",
    response_model=VaultDocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_asset_document(
    asset_id: str,
    request: Request,
    folder: str = Form(default="other"),
    tags: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    document: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> VaultDocumentRead:
    get_user_asset(db, current_user, asset_id)
    uploaded = await upload_document(
        db=db,
        user=current_user,
        upload=document,
        folder=folder,
        tags=tags,
        notes=notes,
        request=request,
        asset_id=asset_id,
        storage_area="asset",
    )
    return document_to_read(uploaded)
