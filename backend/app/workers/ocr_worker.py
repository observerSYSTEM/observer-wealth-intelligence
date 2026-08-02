import time

from app.core.config import settings
from app.core.storage import ensure_storage_paths_writable
from app.db.session import SessionLocal
from app.services.ocr import next_pending_ocr_result, process_ocr_result


def run_once() -> bool:
    db = SessionLocal()
    try:
        result = next_pending_ocr_result(db)
        if result is None:
            return False
        process_ocr_result(db, result)
        return True
    finally:
        db.close()


def run_forever() -> None:
    ensure_storage_paths_writable()
    while True:
        processed = run_once()
        if not processed:
            time.sleep(settings.ocr_worker_poll_seconds)


if __name__ == "__main__":
    run_forever()
