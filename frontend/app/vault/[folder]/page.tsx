"use client";

import { Download, Eye, ScanText, Trash2, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiBaseUrl, apiBlob, apiFetch, errorMessage } from "@/lib/api";
import { formatFileSize, statusLabel } from "@/lib/format";
import type { OCRResult, VaultDocument, VaultDocumentList } from "@/types/finance";

export default function VaultFolderPage() {
  const params = useParams<{ folder: string }>();
  const folder = params.folder;
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrAmount, setOcrAmount] = useState("");
  const [ocrCurrency, setOcrCurrency] = useState("GBP");
  const [ocrDate, setOcrDate] = useState("");
  const [ocrTime, setOcrTime] = useState("");
  const [ocrReference, setOcrReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDocuments = useCallback(async () => {
    const paramsQuery = new URLSearchParams({ folder });
    if (search) paramsQuery.set("search", search);
    const data = await apiFetch<VaultDocumentList>(`/api/v1/vault/documents?${paramsQuery.toString()}`);
    setDocuments(data.items);
  }, [folder, search]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        await loadDocuments();
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadDocuments]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function uploadVaultDocument() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("folder", folder);
    if (tags) form.append("tags", tags);
    if (notes) form.append("notes", notes);
    form.append("document", file);
    try {
      await apiFetch<VaultDocument>("/api/v1/vault/documents", { method: "POST", body: form });
      setFile(null);
      setTags("");
      setNotes("");
      setMessage("Document uploaded.");
      await loadDocuments();
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setBusy(false);
    }
  }

  async function previewDocument(document: VaultDocument) {
    setError(null);
    try {
      const blob = await apiBlob(`/api/v1/vault/documents/${document.id}/content`);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewType(document.media_type);
    } catch (previewError) {
      setError(errorMessage(previewError));
    }
  }

  async function deleteDocument(documentId: string) {
    if (!window.confirm("Delete this document?")) return;
    await apiFetch(`/api/v1/vault/documents/${documentId}`, { method: "DELETE" });
    setDocuments((current) => current.filter((document) => document.id !== documentId));
  }

  async function runOcr(document: VaultDocument) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch<OCRResult>("/api/v1/ocr/jobs", {
        method: "POST",
        body: JSON.stringify({ source_type: "vault_document", source_id: document.id })
      });
      setOcrResult(result);
      setOcrAmount(result.amount ?? "");
      setOcrCurrency(result.currency ?? "GBP");
      setOcrDate(result.document_date ?? "");
      setOcrTime(result.document_time ?? "");
      setOcrReference(result.reference ?? "");
      setMessage("OCR result ready for review.");
    } catch (ocrError) {
      setError(errorMessage(ocrError));
    } finally {
      setBusy(false);
    }
  }

  async function confirmOcr() {
    if (!ocrResult) return;
    setBusy(true);
    setError(null);
    try {
      const confirmed = await apiFetch<OCRResult>(`/api/v1/ocr/results/${ocrResult.id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({
          amount: ocrAmount || null,
          currency: ocrCurrency || null,
          document_date: ocrDate || null,
          document_time: ocrTime || null,
          reference: ocrReference || null,
          status: "confirmed"
        })
      });
      setOcrResult(confirmed);
      setMessage("OCR result confirmed.");
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="grid gap-4 py-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-lg font-semibold">{statusLabel(folder)}</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Upload, preview, download, delete, tag, search, and OCR-review documents.
              </p>
              <div className="mt-5 space-y-4">
                <FormMessage tone="success">{message}</FormMessage>
                <FormMessage tone="error">{error}</FormMessage>
                <Field id="vault-search" label="Search folder">
                  <input id="vault-search" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} />
                </Field>
                <Field id="vault-file" label="Upload document">
                  <input id="vault-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className={inputClass} />
                </Field>
                <Field id="vault-tags" label="Tags">
                  <input id="vault-tags" value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} />
                </Field>
                <Field id="vault-notes" label="Notes">
                  <textarea id="vault-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} min-h-24`} />
                </Field>
                <button type="button" disabled={!file || busy} onClick={() => void uploadVaultDocument()} className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload
                </button>
              </div>
            </div>

            {previewUrl ? (
              <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <h3 className="text-lg font-semibold">Preview</h3>
                {previewType === "application/pdf" ? (
                  <iframe title="Document preview" src={previewUrl} className="mt-4 h-96 w-full rounded-md" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Document preview" src={previewUrl} className="mt-4 max-h-96 rounded-md object-contain" />
                )}
              </div>
            ) : null}

            {ocrResult ? (
              <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <h3 className="text-lg font-semibold">OCR Review</h3>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  Confidence {ocrResult.confidence_score}% - {statusLabel(ocrResult.status)}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field id="ocr-amount" label="Amount">
                    <input id="ocr-amount" type="number" step="0.01" value={ocrAmount} onChange={(event) => setOcrAmount(event.target.value)} className={inputClass} />
                  </Field>
                  <Field id="ocr-currency" label="Currency">
                    <select id="ocr-currency" value={ocrCurrency} onChange={(event) => setOcrCurrency(event.target.value)} className={inputClass}>
                      {["GBP", "USD", "NGN", "EUR"].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </Field>
                  <Field id="ocr-date" label="Date">
                    <input id="ocr-date" type="date" value={ocrDate} onChange={(event) => setOcrDate(event.target.value)} className={inputClass} />
                  </Field>
                  <Field id="ocr-time" label="Time">
                    <input id="ocr-time" value={ocrTime} onChange={(event) => setOcrTime(event.target.value)} className={inputClass} />
                  </Field>
                  <Field id="ocr-reference" label="Reference">
                    <input id="ocr-reference" value={ocrReference} onChange={(event) => setOcrReference(event.target.value)} className={inputClass} />
                  </Field>
                </div>
                <button type="button" disabled={busy || ocrResult.status === "confirmed"} onClick={() => void confirmOcr()} className="mt-4 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  Confirm OCR
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid content-start gap-3 sm:grid-cols-2">
            {documents.map((document) => (
              <article key={document.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{document.original_filename}</h3>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">{formatFileSize(document.file_size)}</p>
                  </div>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                    {document.media_type.split("/")[1]?.toUpperCase()}
                  </span>
                </div>
                <p className="mt-3 text-sm text-black/60 dark:text-white/60">
                  {document.tags || "No tags"}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button type="button" title="Preview" onClick={() => void previewDocument(document)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <a title="Download" href={`${apiBaseUrl}/api/v1/vault/documents/${document.id}/content`} className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <button type="button" title="Run OCR" disabled={busy} onClick={() => void runOcr(document)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10">
                    <ScanText className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" title="Delete" onClick={() => void deleteDocument(document.id)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
            {!documents.length ? (
              <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                No documents in this folder.
              </div>
            ) : null}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
