"use client";

import { Archive, BriefcaseBusiness, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  MetricCard,
  PageHeader,
  SearchInput,
  StatusBadge
} from "@/components/wealth-ui";
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
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadAssets() {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (category) params.set("category", category);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      try {
        const data = await apiFetch<AssetList>(`assets?${params.toString()}`);
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

  async function archiveAsset() {
    if (!archiveId) return;
    setError(null);
    try {
      await apiFetch(`assets/${archiveId}`, { method: "DELETE" });
      setAssets((current) => current.filter((asset) => asset.id !== archiveId));
      setTotal((current) => Math.max(0, current - 1));
      setArchiveId(null);
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Portfolio engine"
            title="Assets"
            subtitle="Track active, sold, closed, and archived assets across all categories."
            icon={<BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />}
            actions={
              <Link href="/assets/new" className={buttonPrimaryClass}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New asset
              </Link>
            }
          />

          <FormMessage tone="error">{error}</FormMessage>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Matched Assets" value={String(total)} icon={<BriefcaseBusiness className="h-5 w-5" />} />
            <MetricCard label="Loaded" value={String(assets.length)} icon={<BriefcaseBusiness className="h-5 w-5" />} />
            <MetricCard label="Category" value={category ? statusLabel(category) : "All"} icon={<BriefcaseBusiness className="h-5 w-5" />} />
            <MetricCard label="Status" value={statusFilter ? statusLabel(statusFilter) : "All"} icon={<BriefcaseBusiness className="h-5 w-5" />} />
          </section>

          <FilterBar>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label htmlFor="asset-search" className="text-sm font-medium">Search</label>
                <div className="mt-2">
                  <SearchInput
                    id="asset-search"
                    value={search}
                    onChange={(value) => {
                      setSearch(value);
                      setOffset(0);
                    }}
                  />
                </div>
              </div>
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
          </FilterBar>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <article
                key={asset.id}
                className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/assets/${asset.id}`} className="truncate font-semibold hover:text-moss">
                      {asset.asset_name}
                    </Link>
                    <p className="mt-1 text-sm text-[color:var(--owi-muted)]">
                      {statusLabel(asset.category)} {asset.institution ? `/ ${asset.institution}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={asset.status} />
                </div>
                <p className="mt-5 text-2xl font-semibold">{formatMoney(asset.current_value, asset.currency)}</p>
                <div className="mt-4 flex items-center gap-2">
                  <Link href={`/assets/${asset.id}`} title="Open asset" className={buttonSecondaryClass}>
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {asset.status !== "archived" ? (
                    <button type="button" title="Archive" onClick={() => setArchiveId(asset.id)} className={buttonSecondaryClass}>
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {!assets.length ? <EmptyState title="No assets match these filters" /> : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - LIMIT))}
              className={buttonSecondaryClass}
            >
              Previous
            </button>
            <span className="text-sm text-[color:var(--owi-muted)]">
              {total ? offset + 1 : 0}-{Math.min(offset + LIMIT, total)} of {total}
            </span>
            <button
              type="button"
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset((current) => current + LIMIT)}
              className={buttonSecondaryClass}
            >
              Next
            </button>
          </div>

          <ConfirmDialog
            open={archiveId !== null}
            title="Archive asset"
            message="This moves the asset out of the active asset list."
            confirmLabel="Archive"
            onConfirm={() => void archiveAsset()}
            onCancel={() => setArchiveId(null)}
          />
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
