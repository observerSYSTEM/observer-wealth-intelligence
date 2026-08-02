# OCR Runtime Validation

OCR runs locally through the `ocr-worker` service.

## Pi Commands

```bash
docker compose -f docker-compose.yml -f docker-compose.pi.yml ps ocr-worker
docker compose -f docker-compose.yml -f docker-compose.pi.yml exec -T ocr-worker python -m app.workers.ocr_worker --healthcheck
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs -f ocr-worker
docker stats
```

The API queues work by inserting `ocr_results` rows with `status=pending`. The worker
claims one pending row at a time, moves it to `processing`, reads the original source file
from the shared `data/receipts` or `data/vault` mount, writes the text artifact under
`data/ocr`, and finishes as `review_required` until the owner confirms or cancels it.

Active duplicate submissions for the same source are idempotent: if a pending,
processing, or review-required OCR row already exists, `/api/v1/ocr/jobs` returns that
row instead of creating a second active job. On startup the worker requeues stale
`processing` rows older than `OCR_PROCESSING_TIMEOUT_SECONDS`.

Expected worker logs include startup, job queued, job claimed, job completed, retry, and
failure messages. Logs never include receipt contents or secrets.

## Required Test Files

Use non-sensitive documents only:

- JPEG receipt.
- PNG receipt.
- WEBP receipt.
- One-page PDF.
- PDF with multiple pages.
- Poor-quality image.
- Malformed PDF.
- Oversized file.

## Required Cases

- Multiple amounts.
- GBP symbol and GBP text.
- NGN symbol and NGN text.
- Date extraction.
- Time extraction.
- Retry path.
- Failed-job path.

## Expected Behavior

- First run may download EasyOCR models.
- Warm runs should be faster than first run.
- Failed jobs stay failed and retain failure reason.
- Retry moves jobs back to pending until the retry limit is reached.
- Worker restart recovery moves abandoned `processing` jobs back to `pending`.
- Confirming OCR updates only the OCR result, never financial records or original files.

Record first-run download time, warm-run time, peak memory, CPU use, and web responsiveness in `docs/RELEASE_CHECKLIST.md` before tagging.
