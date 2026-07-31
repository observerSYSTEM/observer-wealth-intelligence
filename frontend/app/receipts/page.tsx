"use client";

import { Download, Eye, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiBaseUrl, apiBlob, apiFetch, errorMessage } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import type { Receipt, ReceiptList } from "@/types/finance";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadReceipts() {
    const data = await apiFetch<ReceiptList>("/api/v1/receipts");
    setReceipts(data.items);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<ReceiptList>("/api/v1/receipts");
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
      const form = new FormData();
      form.append("receipt", file);
      await apiFetch<Receipt>("/api/v1/receipts", { method: "POST", body: form });
      setFile(null);
      setMessage("Receipt uploaded.");
      await loadReceipts();
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  }

  async function previewReceipt(receipt: Receipt) {
    setError(null);
    try {
      const blob = await apiBlob(`/api/v1/receipts/${receipt.id}/content`);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewType(receipt.media_type);
    } catch (previewError) {
      setError(errorMessage(previewError));
    }
  }

  async function deleteReceipt(receiptId: string) {
    if (!window.confirm("Delete this receipt?")) return;
    await apiFetch(`/api/v1/receipts/${receiptId}`, { method: "DELETE" });
    setReceipts((current) => current.filter((receipt) => receipt.id !== receiptId));
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="grid gap-4 py-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">Receipt Vault</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                JPEG, PNG, WebP and PDF files are supported.
              </p>
              <div className="mt-5 space-y-4">
                <FormMessage tone="success">{message}</FormMessage>
                <FormMessage tone="error">{error}</FormMessage>
                <Field id="receipt-upload" label="Upload receipt">
                  <input
                    id="receipt-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className={inputClass}
                  />
                </Field>
                <button
                  type="button"
                  disabled={!file || uploading}
                  onClick={() => void uploadReceipt()}
                  className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {uploading ? "Uploading" : "Upload"}
                </button>
              </div>
            </div>

            {previewUrl ? (
              <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <h3 className="text-lg font-semibold">Preview</h3>
                {previewType === "application/pdf" ? (
                  <iframe title="Receipt preview" src={previewUrl} className="mt-4 h-96 w-full rounded-md" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Receipt preview" src={previewUrl} className="mt-4 max-h-96 rounded-md object-contain" />
                )}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {receipts.map((receipt) => (
              <article
                key={receipt.id}
                className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{receipt.original_filename}</h3>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      {formatFileSize(receipt.file_size)}
                    </p>
                  </div>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                    {receipt.media_type.split("/")[1]?.toUpperCase()}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-black/60 dark:text-white/60">
                  <p>Uploaded {new Date(receipt.uploaded_at).toLocaleString("en-GB")}</p>
                  <p>
                    Linked entry:{" "}
                    {receipt.linked_entry_id ? (
                      <Link className="font-medium text-moss dark:text-mist" href={`/entries/${receipt.linked_entry_id}`}>
                        Open
                      </Link>
                    ) : (
                      "None"
                    )}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    title="Preview"
                    onClick={() => void previewReceipt(receipt)}
                    className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <a
                    title="Download"
                    href={`${apiBaseUrl}/api/v1/receipts/${receipt.id}/content`}
                    className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => void deleteReceipt(receipt.id)}
                    className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
            {!receipts.length ? (
              <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                No receipts uploaded yet.
              </div>
            ) : null}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
