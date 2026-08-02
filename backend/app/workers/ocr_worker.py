import logging
import sys
import time

from app.core.config import settings
from app.core.storage import ensure_storage_paths_writable
from app.db.session import SessionLocal
from app.services.ocr import (
    next_pending_ocr_result,
    process_ocr_result,
    recover_stale_processing_ocr_results,
)

logger = logging.getLogger(__name__)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def run_once() -> bool:
    db = SessionLocal()
    try:
        result = next_pending_ocr_result(db)
        if result is None:
            return False
        logger.info("OCR worker processing job id=%s", result.id)
        processed = process_ocr_result(db, result)
        logger.info("OCR worker finished job id=%s status=%s", processed.id, processed.status)
        return True
    except Exception:
        logger.exception("OCR worker loop failed")
        return False
    finally:
        db.close()


def recover_processing_jobs() -> int:
    db = SessionLocal()
    try:
        recovered = recover_stale_processing_ocr_results(db)
        if recovered:
            logger.warning("OCR worker recovered stale processing jobs count=%s", recovered)
        return recovered
    finally:
        db.close()


def healthcheck() -> int:
    ensure_storage_paths_writable()
    db = SessionLocal()
    try:
        db.connection()
    finally:
        db.close()
    return 0


def run_forever() -> None:
    configure_logging()
    paths = ensure_storage_paths_writable()
    logger.info(
        "OCR worker startup app_version=%s poll_seconds=%s storage=%s",
        settings.app_version,
        settings.ocr_worker_poll_seconds,
        {name: str(path) for name, path in paths.items()},
    )
    recover_processing_jobs()
    while True:
        processed = run_once()
        if not processed:
            time.sleep(settings.ocr_worker_poll_seconds)


if __name__ == "__main__":
    if "--healthcheck" in sys.argv:
        configure_logging()
        raise SystemExit(healthcheck())
    run_forever()
