"use client";

import { Folder, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
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

  async function runSearch() {
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
        <section className="space-y-4 py-6">
          <div>
            <h2 className="text-xl font-semibold">Digital Vault</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Secure folders for portfolio and personal documents.
            </p>
          </div>
          <FormMessage tone="error">{error}</FormMessage>
          <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Field id="global-search" label="Global search">
                <input
                  id="global-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <button
                type="button"
                onClick={() => void runSearch()}
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </button>
            </div>
          </div>

          {results ? <SearchResultsPanel results={results} /> : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder) => (
              <Link
                key={folder.folder}
                href={`/vault/${folder.folder}`}
                className="rounded-lg border border-black/10 bg-white p-4 shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-mist text-ink dark:bg-white/10 dark:text-white">
                    <Folder className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold">{statusLabel(folder.folder)}</p>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      {folder.document_count} documents
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function SearchResultsPanel({ results }: { results: SearchResults }) {
  const empty =
    !results.assets.length && !results.receipts.length && !results.vault_documents.length;
  if (empty) {
    return (
      <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
        No matching assets, receipts, or vault documents.
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ResultPanel title="Assets">
        {results.assets.map((asset) => (
          <Link key={asset.id} href={`/assets/${asset.id}`} className="block rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
            <span className="font-medium">{asset.asset_name}</span>
            <span className="mt-1 block text-black/60 dark:text-white/60">
              {formatMoney(asset.current_value, asset.currency)}
            </span>
          </Link>
        ))}
      </ResultPanel>
      <ResultPanel title="Receipts">
        {results.receipts.map((receipt) => (
          <Link key={receipt.id} href="/receipts" className="block rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
            {receipt.original_filename}
          </Link>
        ))}
      </ResultPanel>
      <ResultPanel title="Vault">
        {results.vault_documents.map((document) => (
          <Link key={document.id} href={`/vault/${document.folder}`} className="block rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
            {document.original_filename}
          </Link>
        ))}
      </ResultPanel>
    </div>
  );
}

function ResultPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}
