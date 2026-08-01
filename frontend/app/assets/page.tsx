"use client";

import { Archive, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, statusLabel } from "@/lib/format";
import type { Asset, AssetList } from "@/types/finance";

const LIMIT = 12;
const categories = ["", "cash", "investment", "crypto", "property", "business", "trading_account", "vehicle", "other"];
const statuses = ["", "active", "sold", "closed", "archived"];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadAssets() {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (category) params.set("category", category);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      try {
        const data = await apiFetch<AssetList>(`/api/v1/assets?${params.toString()}`);
        if (active) {
          setAssets(data.items);
          setTotal(data.total);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadAssets();
    return () => {
      active = false;
    };
  }, [category, offset, search, statusFilter]);

  async function archiveAsset(assetId: string) {
    if (!window.confirm("Archive this asset?")) return;
    await apiFetch(`/api/v1/assets/${assetId}`, { method: "DELETE" });
    setAssets((current) => current.filter((asset) => asset.id !== assetId));
    setTotal((current) => Math.max(0, current - 1));
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Assets</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">{total} tracked assets</p>
            </div>
            <Link
              href="/assets/new"
              className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New asset
            </Link>
          </div>

          <FormMessage tone="error">{error}</FormMessage>

          <div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5 md:grid-cols-3">
            <Field id="asset-search" label="Search">
              <input
                id="asset-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOffset(0);
                }}
                className={inputClass}
              />
            </Field>
            <Field id="asset-category" label="Category">
              <select
                id="asset-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setOffset(0);
                }}
                className={inputClass}
              >
                {categories.map((item) => (
                  <option key={item || "all"} value={item}>
                    {item ? statusLabel(item) : "All"}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="asset-status" label="Status">
              <select
                id="asset-status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setOffset(0);
                }}
                className={inputClass}
              >
                {statuses.map((item) => (
                  <option key={item || "all"} value={item}>
                    {item ? statusLabel(item) : "All"}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <article
                key={asset.id}
                className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/assets/${asset.id}`} className="truncate font-semibold hover:text-moss">
                      {asset.asset_name}
                    </Link>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      {statusLabel(asset.category)} {asset.institution ? `- ${asset.institution}` : ""}
                    </p>
                  </div>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                    {statusLabel(asset.status)}
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold">
                  {formatMoney(asset.current_value, asset.currency)}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/assets/${asset.id}`}
                    title="Open asset"
                    className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {asset.status !== "archived" ? (
                    <button
                      type="button"
                      title="Archive"
                      onClick={() => void archiveAsset(asset.id)}
                      className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {!assets.length ? (
            <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
              No assets match these filters.
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - LIMIT))}
              className="rounded-md border border-black/10 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/10"
            >
              Previous
            </button>
            <span className="text-sm text-black/60 dark:text-white/60">
              {total ? offset + 1 : 0}-{Math.min(offset + LIMIT, total)} of {total}
            </span>
            <button
              type="button"
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset((current) => current + LIMIT)}
              className="rounded-md border border-black/10 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/10"
            >
              Next
            </button>
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
