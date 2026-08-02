"use client";

import { Download, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, apiUrl, contextualErrorMessage, errorMessage } from "@/lib/api";
import { formatFileSize, formatMoney, statusLabel } from "@/lib/format";
import type { Asset, AssetHistory, AssetHistoryList, VaultDocument, VaultDocumentList } from "@/types/finance";

const folders = ["receipts", "certificates", "land_documents", "company_documents", "insurance", "other"];

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [currentValue, setCurrentValue] = useState("");
  const [notes, setNotes] = useState("");
  const [historyNotes, setHistoryNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState("other");
  const [documentNotes, setDocumentNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAsset = useCallback(async () => {
    const [assetData, historyData, documentsData] = await Promise.all([
      apiFetch<Asset>(`assets/${params.id}`),
      apiFetch<AssetHistoryList>(`assets/${params.id}/history`),
      apiFetch<VaultDocumentList>(`assets/${params.id}/documents`)
    ]);
    setAsset(assetData);
    setCurrentValue(assetData.current_value);
    setNotes(assetData.notes ?? "");
    setHistory(historyData.items);
    setDocuments(documentsData.items);
  }, [params.id]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        await loadAsset();
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadAsset]);

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch<Asset>(`assets/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          current_value: currentValue,
          notes,
          history_notes: historyNotes || null
        })
      });
      setAsset(updated);
      setHistoryNotes("");
      setMessage("Asset saved.");
      const historyData = await apiFetch<AssetHistoryList>(`assets/${params.id}/history`);
      setHistory(historyData.items);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument() {
    if (!file) return;
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("folder", folder);
    if (documentNotes) form.append("notes", documentNotes);
    form.append("document", file);
    try {
      await apiFetch<VaultDocument>(`assets/${params.id}/documents`, {
        method: "POST",
        body: form
      });
      setFile(null);
      setDocumentNotes("");
      setMessage("Document uploaded.");
      await loadAsset();
    } catch (uploadError) {
      setError(contextualErrorMessage(uploadError, "upload"));
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          {asset ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{asset.asset_name}</h2>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                    {statusLabel(asset.category)} - {asset.institution ?? "No institution"}
                  </p>
                </div>
                <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                  {statusLabel(asset.status)}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <form onSubmit={saveAsset} className="space-y-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field id="current-value" label="Current value">
                      <input id="current-value" type="number" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} className={inputClass} />
                    </Field>
                    <Field id="history-notes" label="History note">
                      <input id="history-notes" value={historyNotes} onChange={(event) => setHistoryNotes(event.target.value)} className={inputClass} />
                    </Field>
                  </div>
                  <Field id="asset-notes" label="Notes">
                    <textarea id="asset-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} min-h-28`} />
                  </Field>
                  <button type="submit" disabled={saving} className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {saving ? "Saving" : "Save asset"}
                  </button>
                </form>

                <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <h3 className="text-lg font-semibold">Summary</h3>
                  <SummaryRow label="Current value" value={formatMoney(asset.current_value, asset.currency)} />
                  <SummaryRow label="Purchase price" value={formatMoney(asset.purchase_price, asset.currency)} />
                  <SummaryRow label="Reference" value={asset.reference ?? "None"} />
                  <SummaryRow label="Documents" value={String(asset.document_count)} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <h3 className="text-lg font-semibold">Value History</h3>
                  <div className="mt-4 space-y-3">
                    {history.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 border-b border-black/10 pb-2 text-sm last:border-b-0 dark:border-white/10">
                        <span>{item.valuation_date}</span>
                        <span className="font-semibold">{formatMoney(item.new_value, item.currency)}</span>
                      </div>
                    ))}
                    {!history.length ? <EmptyState message="No history yet." /> : null}
                  </div>
                </section>

                <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <h3 className="text-lg font-semibold">Documents</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                    <Field id="asset-document-folder" label="Folder">
                      <select id="asset-document-folder" value={folder} onChange={(event) => setFolder(event.target.value)} className={inputClass}>
                        {folders.map((item) => (
                          <option key={item} value={item}>{statusLabel(item)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field id="asset-document-file" label="Upload">
                      <input id="asset-document-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className={inputClass} />
                    </Field>
                  </div>
                  <Field id="asset-document-notes" label="Document notes">
                    <input id="asset-document-notes" value={documentNotes} onChange={(event) => setDocumentNotes(event.target.value)} className={inputClass} />
                  </Field>
                  <button type="button" disabled={!file} onClick={() => void uploadDocument()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Upload
                  </button>
                  <div className="mt-4 space-y-2">
                    {documents.map((document) => (
                      <a key={document.id} href={apiUrl(`vault/documents/${document.id}/content`)} className="flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                        <span className="truncate">{document.original_filename}</span>
                        <span className="flex items-center gap-2 text-black/60 dark:text-white/60">
                          {formatFileSize(document.file_size)}
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </a>
                    ))}
                    {!documents.length ? <EmptyState message="No asset documents uploaded." /> : null}
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/10 py-2 text-sm last:border-b-0 dark:border-white/10">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
      {message}
    </div>
  );
}
