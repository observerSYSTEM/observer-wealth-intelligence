"use client";

import { ArrowUpRight, Landmark, PieChart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppFrame } from "@/components/app-frame";
import { FormMessage } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { CategoryValue, PortfolioSummary } from "@/types/finance";

export default function PortfolioPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPortfolio() {
      try {
        const data = await apiFetch<PortfolioSummary>("/api/v1/portfolio/summary");
        if (active) setSummary(data);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadPortfolio();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Portfolio</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Primary-currency view with no FX conversion.
              </p>
            </div>
            <Link
              href="/assets/new"
              className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              Add asset
            </Link>
          </div>
          <FormMessage tone="error">{error}</FormMessage>
          {summary ? <PortfolioContent summary={summary} /> : <Skeleton />}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function PortfolioContent({ summary }: { summary: PortfolioSummary }) {
  const currency = summary.primary_currency;
  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total assets" value={formatMoney(summary.total_assets, currency)} />
        <Metric label="Tracked savings" value={formatMoney(summary.tracked_savings, currency)} />
        <Metric label="Cash" value={formatMoney(summary.cash, currency)} />
        <Metric label="Investments" value={formatMoney(summary.investments, currency)} />
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Panel title="Asset Allocation" icon={<PieChart className="h-5 w-5" aria-hidden="true" />}>
          <AllocationChart rows={summary.allocation} />
        </Panel>
        <Panel title="Goal Progress" icon={<Landmark className="h-5 w-5" aria-hidden="true" />}>
          <div className="space-y-3">
            <p className="text-4xl font-semibold">{formatPercent(summary.goal_progress_percentage)}</p>
            <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
              <div
                className="h-full bg-moss"
                style={{ width: `${Math.min(Number(summary.goal_progress_percentage), 100)}%` }}
              />
            </div>
          </div>
        </Panel>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Portfolio Growth">
          <GrowthChart summary={summary} />
        </Panel>
        <Panel title="Totals By Currency">
          <div className="space-y-2">
            {summary.totals_by_currency.map((item) => (
              <div key={item.currency} className="flex items-center justify-between gap-3 text-sm">
                <span>{item.currency}</span>
                <span className="font-semibold">{formatMoney(item.total_value, item.currency)}</span>
              </div>
            ))}
            {!summary.totals_by_currency.length ? <EmptyState message="No portfolio values yet." /> : null}
          </div>
        </Panel>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent Assets">
          <div className="space-y-2">
            {summary.recent_assets.map((asset) => (
              <Link key={asset.id} href={`/assets/${asset.id}`} className="flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                <span>{asset.asset_name}</span>
                <span className="font-semibold">{formatMoney(asset.current_value, asset.currency)}</span>
              </Link>
            ))}
            {!summary.recent_assets.length ? <EmptyState message="No assets yet." /> : null}
          </div>
        </Panel>
        <Panel title="Recent Receipts">
          <div className="space-y-2">
            {summary.recent_receipts.map((receipt) => (
              <Link key={receipt.id} href="/receipts" className="block rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                {receipt.original_filename}
              </Link>
            ))}
            {!summary.recent_receipts.length ? <EmptyState message="No receipts yet." /> : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function AllocationChart({ rows }: { rows: CategoryValue[] }) {
  const visible = rows.filter((row) => Number(row.total_value) > 0);
  if (!visible.length) return <EmptyState message="No allocation data yet." />;
  return (
    <div className="space-y-3">
      {visible.map((row) => (
        <div key={row.category} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3 text-sm">
          <span className="truncate">{statusLabel(row.category)}</span>
          <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
            <div className="h-full bg-moss" style={{ width: `${Number(row.allocation_percentage)}%` }} />
          </div>
          <span className="text-right font-medium">{formatPercent(row.allocation_percentage)}</span>
        </div>
      ))}
    </div>
  );
}

function GrowthChart({ summary }: { summary: PortfolioSummary }) {
  if (!summary.growth.length) return <EmptyState message="No growth history yet." />;
  const max = Math.max(...summary.growth.map((item) => Number(item.total_value)), 1);
  return (
    <div className="space-y-3">
      {summary.growth.map((item) => (
        <div key={`${item.valuation_date}-${item.total_value}`} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm">
          <span className="truncate text-black/60 dark:text-white/60">{item.valuation_date}</span>
          <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
            <div className="h-full bg-moss" style={{ width: `${Math.max((Number(item.total_value) / max) * 100, 3)}%` }} />
          </div>
          <span className="text-right font-medium">{formatMoney(item.total_value, item.currency)}</span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <p className="text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
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

function Skeleton() {
  return <div className="h-40 animate-pulse rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-white/5" />;
}
