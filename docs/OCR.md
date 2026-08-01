# OCR Runtime Validation

OCR runs locally through the `ocr-worker` service.

## Pi Commands

```bash
docker compose -f docker-compose.yml -f docker-compose.pi.yml logs -f ocr-worker
docker stats
```

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
- Confirming OCR updates only the OCR result, never financial records or original files.

Record first-run download time, warm-run time, peak memory, CPU use, and web responsiveness in `docs/RELEASE_CHECKLIST.md` before tagging.
