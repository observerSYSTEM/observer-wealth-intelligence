from pathlib import Path
from tempfile import NamedTemporaryFile

from app.core.config import settings


def configured_storage_paths() -> dict[str, Path]:
    return {
        "receipts": Path(settings.receipt_storage_path).resolve(),
        "assets": Path(settings.asset_storage_path).resolve(),
        "vault": Path(settings.vault_storage_path).resolve(),
        "ocr": Path(settings.ocr_storage_path).resolve(),
        "backups": Path(settings.backup_storage_path).resolve(),
    }


def ensure_storage_paths_writable() -> dict[str, Path]:
    paths = configured_storage_paths()
    failures: list[str] = []
    for name, path in paths.items():
        try:
            path.mkdir(parents=True, exist_ok=True)
            if not path.is_dir():
                raise OSError(f"{path} is not a directory")
            with NamedTemporaryFile(prefix=".owi-write-test-", dir=path, delete=True) as probe:
                probe.write(b"ok")
                probe.flush()
        except OSError as exc:
            failures.append(f"{name} ({path}): {exc}")

    if failures:
        detail = "; ".join(failures)
        raise RuntimeError(f"Storage path check failed: {detail}")
    return paths
