from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_owner
from app.models.user import User
from app.schemas.backup import (
    BackupRunCreate,
    BackupRunListRead,
    BackupRunRead,
    BackupSettingsRead,
    BackupSettingsUpdate,
    BackupStatusRead,
    BackupVerifyRequest,
)
from app.services.automation import (
    backup_run_to_read,
    backup_settings_to_read,
    backup_status,
    create_backup_archive,
    get_user_backup,
    latest_backup_run,
    list_backup_runs,
    update_backup_settings,
    verify_backup_archive,
)

router = APIRouter()


def get_owner_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required")
    return current_user


@router.get("/status", response_model=BackupStatusRead)
def read_backup_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_owner_user),
) -> BackupStatusRead:
    return backup_status(db, current_user)


@router.get("/history", response_model=BackupRunListRead)
def read_backup_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_owner_user),
) -> BackupRunListRead:
    return list_backup_runs(db, current_user, limit, offset)


@router.patch("/settings", response_model=BackupSettingsRead)
def update_owner_backup_settings(
    payload: BackupSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> BackupSettingsRead:
    return backup_settings_to_read(update_backup_settings(db, current_user, payload, request))


@router.post("/run", response_model=BackupRunRead, status_code=status.HTTP_201_CREATED)
def run_owner_backup(
    payload: BackupRunCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> BackupRunRead:
    return backup_run_to_read(
        create_backup_archive(
            db,
            current_user,
            payload.trigger,
            request,
            dry_run=payload.dry_run,
        )
    )


@router.post("/verify", response_model=BackupRunRead)
def verify_owner_backup(
    payload: BackupVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> BackupRunRead:
    backup = (
        latest_backup_run(db, current_user)
        if payload.latest or payload.backup_id is None
        else get_user_backup(db, current_user, payload.backup_id)
    )
    if backup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    return backup_run_to_read(verify_backup_archive(db, current_user, backup, request))
