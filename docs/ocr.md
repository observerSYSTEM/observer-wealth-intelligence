# OCR Architecture

OCR runs locally. The API creates `ocr_results` rows with status `pending`; the `ocr-worker` service processes them with EasyOCR and PyMuPDF, then moves successful jobs to `review_required`.

Supported sources are receipts and vault documents. Supported media types are PNG, JPEG, WebP, and PDF. The worker enforces configured image pixel limits, PDF page limits, render DPI, and retry limits.

Extracted text, amount candidates, structured fields, confidence scores, engine metadata, and failure messages are stored separately from the original file. The original receipt or document is never overwritten. Users must confirm or cancel the result from the review screen before it becomes final.

Runtime artifacts are written to `data/ocr/<user_id>/<source_type>/<source_id>/<ocr_result_id>.txt`.
