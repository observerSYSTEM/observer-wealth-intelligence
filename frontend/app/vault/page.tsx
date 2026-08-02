"use client";

import { Folder, FolderArchive, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AppFrame } from "@/components/app-frame";
import { FormMessage } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  SearchInput,
  StatusBadge
} from "@/components/wealth-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, statusLabel } from "@/lib/format";
import type { SearchResults, VaultFolderSummary } from "@/types/finance";

export default function VaultPage() {
  const [folders, setFolders] = useState<VaultFolderSummary[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadFolders() {
      try {
        const data = await apiFetch<VaultFolderSummary[]>("/api/v1/vault/folders");
        if (active) setFolders(data);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadFolders();
    return () => {
      active = false;
    };
  }, []);

  const totalDocuments = useMemo(
    () => folders.reduce((total, folder) => total + folder.document_count, 0),
    [folders]
  );

  async function runSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    try {
      const data = await apiFetch<SearchResults>(`/api/v1/search?q=${encodeURIComponent(query)}`);
      setResults(data);
      setError(null);
    } catch (searchError) {
      setError(errorMessage(searchError));
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Digital Vault"
            title="Private Document Archive"
            subtitle="Folders, tags, notes, previews, downloads, and OCR review."
            icon={<FolderArchive className="h-5 w-5" aria-hidden="true" />}
          />
          <FormMessage tone="error">{error}</FormMessage>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Folders" value={String(folders.length)} icon={<Folder className="h-5 w-5" />} />
            <MetricCard label="Documents" value={String(totalDocuments)} icon={<FolderArchive className="h-5 w-5" />} />
            <MetricCard label="Search" value={results ? "Active" : "Ready"} icon={<Search className="h-5 w-5" />} />
            <MetricCard label="Storage Paths" value="Hidden" icon={<FolderArchive className="h-5 w-5" />} />
          </section>

          <Panel title="Global Search" icon={<Search className="h-5 w-5" aria-hidden="true" />}>
            <form onSubmit={(event) => void runSearch(event)} className="grid gap-3 md:grid-cols-[1fr_auto]">
              <SearchInput id="global-search" value={query} onChange={setQuery} placeholder="Search assets, receipts, vault, notes, institution, reference" />
              <button type="submit" className={buttonPrimaryClass}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </button>
            </form>
          </Panel>

          {results ? <SearchResultsPanel results={results} /> : null}

          <Panel title="Folders" icon={<Folder className="h-5 w-5" aria-hidden="true" />}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {folders.map((folder) => (
                <Link
                  key={folder.folder}
                  href={`/vault/${folder.folder}`}
                  className="group rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-4 transition hover:bg-[color:var(--owi-surface-hover)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-md bg-[color:var(--owi-surface)] text-moss dark:text-mist">
                      <Folder className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <StatusBadge status={`${folder.document_count}_docs`} tone="neutral" />
                  </div>
                  <p className="mt-5 font-semibold capitalize">{statusLabel(folder.folder)}</p>
                  <p className="mt-1 text-sm text-[color:var(--owi-muted)]">{folder.document_count} documents</p>
                </Link>
              ))}
              {!folders.length ? <EmptyState title="No vault folders" /> : null}
            </div>
          </Panel>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function SearchResultsPanel({ results }: { results: SearchResults }) {
  const empty =
    !results.assets.length && !results.receipts.length && !results.vault_documents.length;
  if (empty) {
    return <EmptyState title="No matching records" message="Search did not return assets, receipts, or vault documents." />;
  }
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <ResultPanel title="Assets">
        {results.assets.map((asset) => (
          <Link key={asset.id} href={`/assets/${asset.id}`} className="block rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm hover:bg-[color:var(--owi-surface-hover)]">
            <span className="font-semibold">{asset.asset_name}</span>
            <span className="mt-1 block text-[color:var(--owi-muted)]">
              {formatMoney(asset.current_value, asset.currency)}
            </span>
          </Link>
        ))}
      </ResultPanel>
      <ResultPanel title="Receipts">
        {results.receipts.map((receipt) => (
          <Link key={receipt.id} href="/receipts" className="block rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm hover:bg-[color:var(--owi-surface-hover)]">
            {receipt.original_filename}
          </Link>
        ))}
      </ResultPanel>
      <ResultPanel title="Vault">
        {results.vault_documents.map((document) => (
          <Link key={document.id} href={`/vault/${document.folder}`} className="block rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm hover:bg-[color:var(--owi-surface-hover)]">
            <span className="block font-semibold">{document.original_filename}</span>
            <span className="mt-1 block text-[color:var(--owi-muted)]">{statusLabel(document.folder)}</span>
          </Link>
        ))}
      </ResultPanel>
    </div>
  );
}

function ResultPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="space-y-2">{children}</div>
    </Panel>
  );
}
