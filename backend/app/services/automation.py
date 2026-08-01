import hashlib
import json
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.automation import AutomationJob
from app.models.backup_run import BackupRun
from app.models.backup_settings import BackupSettings
from app.models.user import User
from app.schemas.automation import (
    AutomationJobListRead,
    AutomationJobRead,
    BackupRunListRead,
    BackupRunRead,
    BackupScheduleUpdate,
)
from app.schemas.backup import BackupSettingsRead, BackupSettingsUpdate, BackupStatusRead
from app.services.audit import create_audit_log
from app.services.notifications import notify_user

BACKUP_JOB_TYPE = "scheduled_backup"


def backup_root() -> Path:
    return Path(settings.backup_storage_path).resolve()


def safe_backup_path(filename: str) -> Path:
    root = backup_root()
    path = (root / filename).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid backup storage path",
        ) from exc
    return path


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def storage_roots() -> list[tuple[str, Path]]:
    return [
        ("assets", Path(settings.asset_storage_path).resolve()),
        ("vault", Path(settings.vault_storage_path).resolve()),
        ("receipts", Path(settings.receipt_storage_path).resolve()),
        ("ocr", Path(settings.ocr_storage_path).resolve()),
    ]


def iter_storage_files() -> list[tuple[str, Path, Path]]:
    rows: list[tuple[str, Path, Path]] = []
    for area, root in storage_roots():
        if not root.exists():
            continue
        for path in sorted(item for item in root.rglob("*") if item.is_file()):
            resolved = path.resolve()
            try:
                relative = resolved.relative_to(root)
            except ValueError:
                continue
            rows.append((area, resolved, relative))
    return rows


def next_run_for(user: User, cadence: str, run_at_time: str) -> datetime:
    hour, minute = (int(part) for part in run_at_time.split(":"))
    timezone = ZoneInfo(user.timezone)
    now_local = datetime.now(UTC).astimezone(timezone)
    candidate = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now_local:
        candidate += timedelta(days=7 if cadence == "weekly" else 1)
    return candidate.astimezone(UTC)


def automation_job_to_read(job: AutomationJob) -> AutomationJobRead:
    return AutomationJobRead.model_validate(job, from_attributes=True)


def backup_run_to_read(backup: BackupRun) -> BackupRunRead:
    return BackupRunRead.model_validate(backup, from_attributes=True)


def backup_settings_to_read(backup_settings: BackupSettings) -> BackupSettingsRead:
    return BackupSettingsRead.model_validate(backup_settings, from_attributes=True)


def get_or_create_backup_settings(db: Session, user: User) -> BackupSettings:
    backup_settings = db.scalar(
        select(BackupSettings).where(BackupSettings.user_id == user.id)
    )
    if backup_settings is not None:
        return backup_settings
    backup_settings = BackupSettings(
        user_id=user.id,
        backup_path=settings.backup_storage_path,
        enabled=True,
        frequency="daily",
        run_time="02:00",
    )
    db.add(backup_settings)
    db.flush()
    return backup_settings


def get_or_create_backup_job(db: Session, user: User) -> AutomationJob:
    job = db.scalar(
        select(AutomationJob).where(
            AutomationJob.user_id == user.id,
            AutomationJob.job_type == BACKUP_JOB_TYPE,
        )
    )
    if job is not None:
        return job
    job = AutomationJob(
        user_id=user.id,
        job_type=BACKUP_JOB_TYPE,
        name="Raspberry Pi scheduled backup",
        enabled=settings.backup_schedule_enabled,
        cadence="daily",
        run_at_time=settings.backup_schedule_time,
        configuration=json.dumps({"storage_areas": ["assets", "vault", "receipts", "ocr"]}),
    )
    if job.enabled:
        job.next_run_at = next_run_for(user, job.cadence, job.run_at_time)
    db.add(job)
    db.flush()
    return job


def list_automation_jobs(db: Session, user: User) -> AutomationJobListRead:
    get_or_create_backup_job(db, user)
    items = list(
        db.scalars(
            select(AutomationJob)
            .where(AutomationJob.user_id == user.id)
            .order_by(AutomationJob.job_type)
        ).all()
    )
    db.commit()
    return AutomationJobListRead(
        items=[automation_job_to_read(item) for item in items],
        total=len(items),
    )


def update_backup_schedule(
    db: Session,
    user: User,
    payload: BackupScheduleUpdate,
    request: Request | None = None,
) -> AutomationJob:
    job = get_or_create_backup_job(db, user)
    job.enabled = payload.enabled
    job.cadence = payload.cadence
    job.run_at_time = payload.run_at_time
    job.status = "scheduled" if payload.enabled else "disabled"
    job.next_run_at = (
        next_run_for(user, payload.cadence, payload.run_at_time) if payload.enabled else None
    )
    notify_user(
        db,
        user,
        title="Backup schedule updated",
        message=(
            f"Scheduled backups are {'enabled' if payload.enabled else 'disabled'}"
            f" at {payload.run_at_time}."
        ),
        notification_type="backup_success",
        severity="success",
        related_type="automation_job",
        related_id=job.id,
        request=request,
    )
    create_audit_log(db, "backup_schedule_update", user.id, request, {"job_id": job.id})
    db.commit()
    db.refresh(job)
    return job


def create_backup_archive(
    db: Session,
    user: User,
    trigger: str,
    request: Request | None = None,
    dry_run: bool = False,
) -> BackupRun:
    backup_settings = get_or_create_backup_settings(db, user)
    root = backup_root()
    root.mkdir(parents=True, exist_ok=True)
    job = get_or_create_backup_job(db, user)
    now = datetime.now(UTC)
    backup = BackupRun(
        user_id=user.id,
        job_id=job.id,
        trigger=trigger,
        status="running",
        started_at=now,
    )
    db.add(backup)
    db.flush()
    filename = f"owi-backup-{now:%Y%m%d-%H%M%S}-{backup.id[:8]}.zip"
    archive_path = safe_backup_path(filename)
    temporary_path = archive_path.with_suffix(".zip.tmp")

    manifest: dict[str, object] = {
        "backup_id": backup.id,
        "created_at": now.isoformat(),
        "dry_run": dry_run,
        "application_version": "1.0.0",
        "migration_revision": "20260801_0005",
        "storage_areas": ["assets", "vault", "receipts", "ocr"],
        "database": {
            "included": False,
            "reason": (
                "Application-level backups include storage files only; "
                "deploy/backup.sh creates PostgreSQL dumps."
            ),
        },
        "files": [],
    }

    try:
        if dry_run:
            backup.status = "completed"
            backup.completed_at = datetime.now(UTC)
            backup.verification_message = "Dry run completed; no archive was written"
            backup.manifest_json = json.dumps(manifest, sort_keys=True)
            create_audit_log(db, "backup_dry_run", user.id, request, {"backup_id": backup.id})
            db.commit()
            db.refresh(backup)
            return backup

        with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            file_rows: list[dict[str, object]] = []
            for area, path, relative in iter_storage_files():
                digest = file_sha256(path)
                archive_name = str(Path("data") / area / relative).replace("\\", "/")
                archive.write(path, archive_name)
                file_rows.append(
                    {
                        "area": area,
                        "archive_path": archive_name,
                        "sha256": digest,
                        "size_bytes": path.stat().st_size,
                    }
                )
            manifest["files"] = file_rows
            archive.writestr("manifest.json", json.dumps(manifest, indent=2, sort_keys=True))
            archive.writestr(
                "database/DATABASE_DUMP_NOT_INCLUDED.txt",
                "Use deploy/backup.sh for PostgreSQL dump backups from the Docker host.\n",
            )
        with zipfile.ZipFile(temporary_path) as archive:
            if "manifest.json" not in archive.namelist():
                raise ValueError("Backup manifest is missing")
            if "database/DATABASE_DUMP_NOT_INCLUDED.txt" not in archive.namelist():
                raise ValueError("Database dump marker is missing")
            if archive.testzip() is not None:
                raise ValueError("Backup archive readability check failed")
        temporary_path.replace(archive_path)
        backup.backup_filename = filename
        backup.sha256 = file_sha256(archive_path)
        backup.size_bytes = archive_path.stat().st_size
        backup.manifest_json = json.dumps(manifest, sort_keys=True)
        backup.status = "completed"
        backup.completed_at = datetime.now(UTC)
        backup_settings.last_success_at = backup.completed_at
        job.last_run_at = backup.completed_at
        job.status = "scheduled" if job.enabled else "idle"
        if job.enabled:
            job.next_run_at = next_run_for(user, job.cadence, job.run_at_time)
        create_audit_log(db, "backup_create", user.id, request, {"backup_id": backup.id})
        verify_backup_archive(db, user, backup, request, commit=False)
        notify_user(
            db,
            user,
            title="Backup completed",
            message="Local storage backup completed and checksum verification passed.",
            notification_type="backup_success",
            severity="success",
            related_type="backup_run",
            related_id=backup.id,
            request=request,
        )
    except Exception as exc:
        if temporary_path.exists():
            temporary_path.unlink()
        backup.status = "failed"
        backup.error_message = str(exc)[:1000]
        backup.completed_at = datetime.now(UTC)
        backup_settings.last_failure_at = backup.completed_at
        notify_user(
            db,
            user,
            title="Backup failed",
            message=backup.error_message,
            notification_type="backup_failure",
            severity="critical",
            related_type="backup_run",
            related_id=backup.id,
            request=request,
        )
    db.commit()
    db.refresh(backup)
    return backup


def get_user_backup(db: Session, user: User, backup_id: str) -> BackupRun:
    backup = db.get(BackupRun, backup_id)
    if backup is None or backup.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    return backup


def verify_backup_archive(
    db: Session,
    user: User,
    backup: BackupRun,
    request: Request | None = None,
    commit: bool = True,
) -> BackupRun:
    if not backup.backup_filename:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Backup has no archive")
    archive_path = safe_backup_path(backup.backup_filename)
    if not archive_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup archive not found",
        )

    try:
        with zipfile.ZipFile(archive_path) as archive:
            corrupt = archive.testzip()
            if corrupt is not None:
                raise ValueError(f"Archive entry failed CRC: {corrupt}")
            manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
            if "database" not in manifest:
                raise ValueError("Database manifest entry is missing")
            for row in manifest.get("files", []):
                archive_name = row["archive_path"]
                expected_sha = row["sha256"]
                digest = hashlib.sha256(archive.read(archive_name)).hexdigest()
                if digest != expected_sha:
                    raise ValueError(f"Checksum mismatch for {archive_name}")
        backup.restore_verified = True
        backup.verified_at = datetime.now(UTC)
        backup.verification_message = "Archive manifest and file checksums verified"
        backup.error_message = None
    except Exception as exc:
        backup.restore_verified = False
        backup.verified_at = datetime.now(UTC)
        backup.verification_message = str(exc)[:1000]
        backup.error_message = backup.verification_message
        backup.status = "failed"
    create_audit_log(db, "backup_verify", user.id, request, {"backup_id": backup.id})
    if commit:
        db.commit()
        db.refresh(backup)
    return backup


def list_backup_runs(
    db: Session,
    user: User,
    limit: int,
    offset: int,
) -> BackupRunListRead:
    total = (
        db.scalar(
            select(func.count()).select_from(BackupRun).where(BackupRun.user_id == user.id)
        )
        or 0
    )
    items = list(
        db.scalars(
            select(BackupRun)
            .where(BackupRun.user_id == user.id)
            .order_by(desc(BackupRun.started_at))
            .limit(limit)
            .offset(offset)
        ).all()
    )
    return BackupRunListRead(
        items=[backup_run_to_read(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def update_backup_settings(
    db: Session,
    user: User,
    payload: BackupSettingsUpdate,
    request: Request | None = None,
) -> BackupSettings:
    backup_settings = get_or_create_backup_settings(db, user)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(backup_settings, key, value)
    job = get_or_create_backup_job(db, user)
    frequency = backup_settings.frequency
    job.enabled = backup_settings.enabled and frequency != "disabled"
    job.cadence = "weekly" if frequency == "weekly" else "daily"
    job.run_at_time = backup_settings.run_time
    job.status = "scheduled" if job.enabled else "disabled"
    job.next_run_at = next_run_for(user, job.cadence, job.run_at_time) if job.enabled else None
    create_audit_log(
        db,
        "backup_settings_update",
        user.id,
        request,
        {"changed_fields": sorted(changes.keys())},
    )
    db.commit()
    db.refresh(backup_settings)
    return backup_settings


def backup_status(db: Session, user: User) -> BackupStatusRead:
    backup_settings = get_or_create_backup_settings(db, user)
    latest = db.scalar(
        select(BackupRun)
        .where(BackupRun.user_id == user.id)
        .order_by(desc(BackupRun.started_at))
        .limit(1)
    )
    latest_success = db.scalar(
        select(BackupRun)
        .where(BackupRun.user_id == user.id, BackupRun.status == "completed")
        .order_by(desc(BackupRun.started_at))
        .limit(1)
    )
    latest_failure = db.scalar(
        select(BackupRun)
        .where(BackupRun.user_id == user.id, BackupRun.status == "failed")
        .order_by(desc(BackupRun.started_at))
        .limit(1)
    )
    db.commit()
    return BackupStatusRead(
        settings=backup_settings_to_read(backup_settings),
        latest_backup=backup_run_to_read(latest) if latest is not None else None,
        latest_success=backup_run_to_read(latest_success) if latest_success is not None else None,
        latest_failure=backup_run_to_read(latest_failure) if latest_failure is not None else None,
    )


def latest_backup_run(db: Session, user: User) -> BackupRun | None:
    return db.scalar(
        select(BackupRun)
        .where(BackupRun.user_id == user.id)
        .order_by(desc(BackupRun.started_at))
        .limit(1)
    )
