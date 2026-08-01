"use client";

import {
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Coins,
  Landmark,
  LineChart,
  PiggyBank,
  ReceiptText,
  Target
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AppFrame } from "@/components/app-frame";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { DashboardSummary } from "@/types/finance";

export function DashboardShell() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      try {
        const data = await apiFetch<DashboardSummary>("/api/v1/dashboard/summary");
        if (active) setSummary(data);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadSummary();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div>
            <h2 className="text-xl font-semibold">Dashboard</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Portfolio, vault, and tracked savings overview.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/assets/new" className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white">
              New asset
            </Link>
            <Link href="/entries/new" className="rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold dark:border-white/10">
              New entry
            </Link>
          </div>
        </section>

        {error ? (
          <p className="rounded-md border border-copper/30 bg-copper/10 px-3 py-2 text-sm font-medium text-copper dark:text-[#ffb088]">
            {error}
          </p>
        ) : null}

        {summary ? <DashboardContent summary={summary} /> : <DashboardSkeleton />}
      </AppFrame>
    </ProtectedRoute>
  );
}

function DashboardContent({ summary }: { summary: DashboardSummary }) {
  const currency = summary.tracked_savings_currency;

  return (
    <div className="space-y-4 pb-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Landmark className="h-5 w-5" />} label="Total Assets" value={formatMoney(summary.total_assets, currency)} />
        <MetricCard icon={<PiggyBank className="h-5 w-5" />} label="Tracked Savings" value={formatMoney(summary.tracked_savings, currency)} />
        <MetricCard icon={<Banknote className="h-5 w-5" />} label="Cash" value={formatMoney(summary.cash, currency)} />
        <MetricCard icon={<LineChart className="h-5 w-5" />} label="Investments" value={formatMoney(summary.investments, currency)} />
        <MetricCard icon={<Building2 className="h-5 w-5" />} label="Property" value={formatMoney(summary.property, currency)} />
        <MetricCard icon={<Coins className="h-5 w-5" />} label="Crypto" value={formatMoney(summary.crypto, currency)} />
        <MetricCard icon={<BriefcaseBusiness className="h-5 w-5" />} label="Business" value={formatMoney(summary.business, currency)} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Trading Accounts" value={formatMoney(summary.trading_accounts, currency)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <Panel title="Asset Allocation">
          <AllocationChart summary={summary} />
        </Panel>
        <Panel title="Goal Progress">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-moss dark:text-mist" aria-hidden="true" />
              <p className="text-3xl font-semibold">{formatPercent(summary.goal_progress_percentage)}</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
              <div
                className="h-full bg-moss"
                style={{ width: `${Math.min(Number(summary.goal_progress_percentage), 100)}%` }}
              />
            </div>
            <p className="text-sm text-black/60 dark:text-white/60">
              Primary goal: {formatMoney(summary.primary_goal_amount, summary.primary_goal_currency)}
            </p>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Portfolio Growth">
          <PortfolioGrowthChart summary={summary} />
        </Panel>
        <Panel title="Daily Savings">
          <SavingsChart data={summary.daily_savings} currency={currency} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
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
              <Link key={receipt.id} href="/receipts" className="flex items-center gap-3 rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                <ReceiptText className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{receipt.original_filename}</span>
              </Link>
            ))}
            {!summary.recent_receipts.length ? <EmptyState message="No receipts yet." /> : null}
          </div>
        </Panel>
        <Panel title="Latest Entries">
          <div className="space-y-2">
            {summary.latest_entries.map((entry) => (
              <Link key={entry.id} href={`/entries/${entry.id}`} className="flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 text-sm hover:bg-mist dark:border-white/10 dark:hover:bg-white/10">
                <span>{entry.entry_date} - {statusLabel(entry.income_source)}</span>
                <span className="font-semibold">{formatMoney(entry.actual_savings, entry.currency)}</span>
              </Link>
            ))}
            {!summary.latest_entries.length ? <EmptyState message="No entries yet." /> : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-mist text-ink dark:bg-white/10 dark:text-white">
        {icon}
      </span>
      <p className="mt-4 text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AllocationChart({ summary }: { summary: DashboardSummary }) {
  const rows = summary.asset_allocation.filter((row) => Number(row.total_value) > 0);
  if (!rows.length) return <EmptyState message="No allocation data yet." />;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
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

function PortfolioGrowthChart({ summary }: { summary: DashboardSummary }) {
  if (!summary.portfolio_growth.length) return <EmptyState message="No portfolio history yet." />;
  const max = Math.max(...summary.portfolio_growth.map(([, , value]) => Number(value)), 1);
  return (
    <div className="space-y-3">
      {summary.portfolio_growth.map(([date, pointCurrency, value]) => (
        <div key={`${date}-${value}`} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm">
          <span className="truncate text-black/60 dark:text-white/60">{date}</span>
          <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
            <div className="h-full bg-moss" style={{ width: `${Math.max((Number(value) / max) * 100, 3)}%` }} />
          </div>
          <span className="text-right font-medium">{formatMoney(value, pointCurrency)}</span>
        </div>
      ))}
    </div>
  );
}

function SavingsChart({ data, currency }: { data: Array<[string, string]>; currency: string }) {
  if (!data.length) return <EmptyState message="No savings chart data yet." />;
  const max = Math.max(...data.map(([, value]) => Number(value)), 1);
  return (
    <div className="space-y-3">
      {data.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm">
          <span className="truncate text-black/60 dark:text-white/60">{label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
            <div className="h-full bg-moss" style={{ width: `${Math.max((Number(value) / max) * 100, 3)}%` }} />
          </div>
          <span className="text-right font-medium">{formatMoney(value, currency)}</span>
        </div>
      ))}
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

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-white/5" />
      ))}
    </div>
  );
}
