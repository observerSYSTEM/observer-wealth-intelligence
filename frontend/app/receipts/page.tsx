"use client";

import { Download, Eye, ReceiptText, ScanText, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { FormMessage } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  ConfirmDialog,
  EmptyState,
  FileUploader,
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge
} from "@/components/wealth-ui";
import { apiBlob, apiFetch, apiUrl, contextualErrorMessage, errorMessage } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import { uploadReceiptFile } from "@/lib/uploads";
import type { OCRResult, Receipt, ReceiptList } from "@/types/finance";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrProcessingId, setOcrProcessingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function loadReceipts() {
    const data = await apiFetch<ReceiptList>("receipts");
    setReceipts(data.items);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<ReceiptList>("receipts");
        if (active) setReceipts(data.items);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function uploadReceipt() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      await uploadReceiptFile<Receipt>(file);
      setFile(null);
      setMessage("Receipt uploaded.");
      await loadReceipts();
    } catch (uploadError) {
      setError(contextualErrorMessage(uploadError, "upload"));
    } finally {
      setUploading(false);
    }
  }

  async function previewReceipt(receipt: Receipt) {
    setError(null);
    try {
      const blob = await apiBlob(`receipts/${receipt.id}/content`);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewType(receipt.media_type);
    } catch (previewError) {
      setError(errorMessage(previewError));
    }
  }

  async function deleteReceipt() {
    if (!deleteId) return;
    setError(null);
    try {
      await apiFetch(`receipts/${deleteId}`, { method: "DELETE" });
      setReceipts((current) => current.filter((receipt) => receipt.id !== deleteId));
      setDeleteId(null);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  async function runReceiptOCR(receipt: Receipt) {
    setOcrProcessingId(receipt.id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<OCRResult>("ocr/jobs", {
        method: "POST",
        body: JSON.stringify({ source_type: "receipt", source_id: receipt.id })
      });
      setMessage("OCR review ready.");
    } catch (ocrError) {
      setError(contextualErrorMessage(ocrError, "ocr"));
    } finally {
      setOcrProcessingId(null);
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Document intake"
            title="Receipt Vault"
            subtitle="Upload receipts, preview originals, and queue OCR for manual review."
            icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}
          />
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>

          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-5">
              <Panel title="Upload Receipt" icon={<Upload className="h-5 w-5" aria-hidden="true" />}>
                <FileUploader
                  id="receipt-upload"
                  label="Select or drop receipt"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  file={file}
                  onFileChange={setFile}
                  helper="PNG, JPEG, WebP or PDF"
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--owi-surface-elevated)]">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-moss dark:bg-mist" />
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={!file || uploading}
                  onClick={() => void uploadReceipt()}
                  className={`${buttonPrimaryClass} mt-4`}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {uploading ? "Uploading" : "Upload"}
                </button>
              </Panel>

              <Panel title="Receipt Status">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Stored Receipts" value={String(receipts.length)} />
                  <MetricCard label="OCR Running" value={ocrProcessingId ? "1" : "0"} />
                </div>
              </Panel>

              {previewUrl ? (
                <Panel title="Preview" icon={<Eye className="h-5 w-5" aria-hidden="true" />}>
                  {previewType === "application/pdf" ? (
                    <iframe title="Receipt preview" src={previewUrl} className="h-96 w-full rounded-md border border-[color:var(--owi-border)]" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Receipt preview" src={previewUrl} className="max-h-96 w-full rounded-md object-contain" />
                  )}
                </Panel>
              ) : null}
            </div>

            <Panel title="Stored Receipts" icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                {receipts.map((receipt) => (
                  <article
                    key={receipt.id}
                    className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{receipt.original_filename}</h3>
                        <p className="mt-1 text-sm text-[color:var(--owi-muted)]">
                          {formatFileSize(receipt.file_size)}
                        </p>
                      </div>
                      <StatusBadge status={receipt.media_type.split("/")[1] ?? "file"} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--owi-muted)]">
                      <p>Uploaded {new Date(receipt.uploaded_at).toLocaleString("en-GB")}</p>
                      <p>
                        Linked entry:{" "}
                        {receipt.linked_entry_id ? (
                          <Link className="font-semibold text-moss dark:text-mist" href={`/entries/${receipt.linked_entry_id}`}>
                            Open
                          </Link>
                        ) : (
                          "None"
                        )}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        title="Preview"
                        onClick={() => void previewReceipt(receipt)}
                        className={buttonSecondaryClass}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <a
                        title="Download"
                        href={apiUrl(`receipts/${receipt.id}/content`)}
                        className={buttonSecondaryClass}
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        title="Run OCR"
                        disabled={ocrProcessingId === receipt.id}
                        onClick={() => void runReceiptOCR(receipt)}
                        className={buttonSecondaryClass}
                      >
                        <ScanText className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeleteId(receipt.id)}
                        className={buttonSecondaryClass}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
                {!receipts.length ? (
                  <EmptyState title="No receipts uploaded" message="Upload a receipt to begin OCR review." />
                ) : null}
              </div>
            </Panel>
          </div>

          <ConfirmDialog
            open={deleteId !== null}
            title="Delete receipt"
            message="This removes the stored receipt record and its private file."
            confirmLabel="Delete"
            onConfirm={() => void deleteReceipt()}
            onCancel={() => setDeleteId(null)}
          />
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
