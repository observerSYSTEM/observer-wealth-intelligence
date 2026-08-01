from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_csrf
from app.models.user import User
from app.schemas.common import MessageRead
from app.schemas.vault import (
    VaultDocumentListRead,
    VaultDocumentRead,
    VaultDocumentUpdate,
    VaultFolderSummaryRead,
)
from app.services.vault import (
    content_response,
    delete_document,
    document_to_read,
    folder_summaries,
    get_user_document,
    list_documents,
    update_document,
    upload_document,
)

router = APIRouter()


@router.get("/folders", response_model=list[VaultFolderSummaryRead])
def read_vault_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[VaultFolderSummaryRead]:
    return folder_summaries(db, current_user)


@router.post("/documents", response_model=VaultDocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_vault_document(
    request: Request,
    folder: str = Form(default="other"),
    tags: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    document: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> VaultDocumentRead:
    uploaded = await upload_document(
        db=db,
        user=current_user,
        upload=document,
        folder=folder,
        tags=tags,
        notes=notes,
        request=request,
    )
    return document_to_read(uploaded)


@router.get("/documents", response_model=VaultDocumentListRead)
def read_vault_documents(
    folder: str | None = None,
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VaultDocumentListRead:
    return list_documents(db, current_user, folder, search, limit, offset)


@router.get("/documents/{document_id}", response_model=VaultDocumentRead)
def read_vault_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VaultDocumentRead:
    return document_to_read(get_user_document(db, current_user, document_id))


@router.get("/documents/{document_id}/content", response_class=FileResponse)
def read_vault_document_content(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    return content_response(get_user_document(db, current_user, document_id))


@router.patch("/documents/{document_id}", response_model=VaultDocumentRead)
def update_vault_document(
    document_id: str,
    payload: VaultDocumentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> VaultDocumentRead:
    document = get_user_document(db, current_user, document_id)
    return document_to_read(update_document(db, current_user, document, payload, request))


@router.delete("/documents/{document_id}", response_model=MessageRead)
def delete_vault_document(
    document_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_csrf),
) -> MessageRead:
    delete_document(db, current_user, get_user_document(db, current_user, document_id), request)
    return MessageRead(message="Document deleted")
