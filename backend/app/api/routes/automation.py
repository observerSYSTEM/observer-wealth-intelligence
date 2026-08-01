from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_owner
from app.models.user import User
from app.schemas.automation import (
    AutomationJobListRead,
    AutomationJobRead,
    BackupRunCreate,
    BackupRunListRead,
    BackupRunRead,
    BackupScheduleUpdate,
)
from app.services.automation import (
    automation_job_to_read,
    backup_run_to_read,
    create_backup_archive,
    get_user_backup,
    list_automation_jobs,
    list_backup_runs,
    update_backup_schedule,
    verify_backup_archive,
)

router = APIRouter()


def get_owner_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required")
    return current_user


@router.get("/jobs", response_model=AutomationJobListRead)
def read_automation_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_owner_user),
) -> AutomationJobListRead:
    return list_automation_jobs(db, current_user)


@router.put("/backups/schedule", response_model=AutomationJobRead)
def update_scheduled_backup(
    payload: BackupScheduleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> AutomationJobRead:
    return automation_job_to_read(update_backup_schedule(db, current_user, payload, request))


@router.post("/backups/run", response_model=BackupRunRead, status_code=status.HTTP_201_CREATED)
def run_backup(
    payload: BackupRunCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> BackupRunRead:
    return backup_run_to_read(create_backup_archive(db, current_user, payload.trigger, request))


@router.get("/backups", response_model=BackupRunListRead)
def read_backups(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_owner_user),
) -> BackupRunListRead:
    return list_backup_runs(db, current_user, limit, offset)


@router.post("/backups/{backup_id}/verify", response_model=BackupRunRead)
def verify_backup(
    backup_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> BackupRunRead:
    backup = get_user_backup(db, current_user, backup_id)
    return backup_run_to_read(verify_backup_archive(db, current_user, backup, request))
