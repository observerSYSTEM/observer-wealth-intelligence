"use client";

import { Download, Eye, FolderArchive, ScanText, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
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
  SearchInput,
  StatusBadge
} from "@/components/wealth-ui";
import { apiBlob, apiFetch, apiUrl, errorMessage } from "@/lib/api";
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  async function deleteDocument() {
    if (!deleteId) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/vault/documents/${deleteId}`, { method: "DELETE" });
      setDocuments((current) => current.filter((document) => document.id !== deleteId));
      setDeleteId(null);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
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
      setMessage("OCR job queued.");
    } catch (ocrError) {
      setError(errorMessage(ocrError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Vault folder"
            title={statusLabel(folder)}
            subtitle="Upload, tag, preview, download, delete, and OCR-review documents."
            icon={<FolderArchive className="h-5 w-5" aria-hidden="true" />}
          />
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Documents" value={String(documents.length)} icon={<FolderArchive className="h-5 w-5" />} />
            <MetricCard label="Selected File" value={file ? "Ready" : "None"} icon={<Upload className="h-5 w-5" />} />
            <MetricCard label="OCR Status" value={ocrResult ? statusLabel(ocrResult.status) : "Idle"} icon={<ScanText className="h-5 w-5" />} />
            <MetricCard label="Search" value={search ? "Filtered" : "All"} icon={<Search className="h-5 w-5" />} />
          </section>

          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-5">
              <Panel title="Upload Document" icon={<Upload className="h-5 w-5" aria-hidden="true" />}>
                <div className="space-y-4">
                  <SearchInput id="vault-search" value={search} onChange={setSearch} placeholder="Search this folder" />
                  <FileUploader
                    id="vault-file"
                    label="Select or drop document"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    file={file}
                    onFileChange={setFile}
                    helper="PNG, JPEG, WebP or PDF"
                    disabled={busy}
                  />
                  <Field id="vault-tags" label="Tags">
                    <input id="vault-tags" value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} />
                  </Field>
                  <Field id="vault-notes" label="Notes">
                    <textarea id="vault-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} min-h-24`} />
                  </Field>
                  <button type="button" disabled={!file || busy} onClick={() => void uploadVaultDocument()} className={buttonPrimaryClass}>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    {busy ? "Working" : "Upload"}
                  </button>
                </div>
              </Panel>

              {previewUrl ? (
                <Panel title="Preview" icon={<Eye className="h-5 w-5" aria-hidden="true" />}>
                  {previewType === "application/pdf" ? (
                    <iframe title="Document preview" src={previewUrl} className="h-96 w-full rounded-md border border-[color:var(--owi-border)]" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Document preview" src={previewUrl} className="max-h-96 w-full rounded-md object-contain" />
                  )}
                </Panel>
              ) : null}

              {ocrResult ? (
                <Panel title="OCR Job" icon={<ScanText className="h-5 w-5" aria-hidden="true" />}>
                  <StatusBadge status={ocrResult.status} />
                  <Link href={`/ocr/${ocrResult.id}`} className={`${buttonPrimaryClass} mt-4`}>
                    Open OCR review
                  </Link>
                </Panel>
              ) : null}
            </div>

            <Panel title="Documents" icon={<FolderArchive className="h-5 w-5" aria-hidden="true" />}>
              <div className="grid content-start gap-3 sm:grid-cols-2">
                {documents.map((document) => (
                  <article key={document.id} className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{document.original_filename}</h3>
                        <p className="mt-1 text-sm text-[color:var(--owi-muted)]">{formatFileSize(document.file_size)}</p>
                      </div>
                      <StatusBadge status={document.media_type.split("/")[1] ?? "file"} />
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--owi-muted)]">
                      <p>{document.tags || "No tags"}</p>
                      <p>Uploaded {new Date(document.uploaded_at).toLocaleString("en-GB")}</p>
                      <p className="break-all">SHA256 {document.sha256}</p>
                    </div>
                    {document.notes ? (
                      <p className="mt-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-3 text-sm leading-6 text-[color:var(--owi-muted)]">
                        {document.notes}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button type="button" title="Preview" onClick={() => void previewDocument(document)} className={buttonSecondaryClass}>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <a title="Download" href={apiUrl(`/api/v1/vault/documents/${document.id}/content`)} className={buttonSecondaryClass}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </a>
                      <button type="button" title="Run OCR" disabled={busy} onClick={() => void runOcr(document)} className={buttonSecondaryClass}>
                        <ScanText className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" title="Delete" onClick={() => setDeleteId(document.id)} className={buttonSecondaryClass}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
                {!documents.length ? <EmptyState title="No documents in this folder" /> : null}
              </div>
            </Panel>
          </div>

          <ConfirmDialog
            open={deleteId !== null}
            title="Delete document"
            message="This removes the vault record and private document file."
            confirmLabel="Delete"
            onConfirm={() => void deleteDocument()}
            onCancel={() => setDeleteId(null)}
            busy={busy}
          />
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
