"use client";

import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChartPie,
  Coins,
  Landmark,
  LineChart,
  PieChart,
  ReceiptText,
  Target,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { FormMessage } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  AllocationChart,
  buttonPrimaryClass,
  CurrencySelector,
  EmptyState,
  GoalProgress,
  MetricCard,
  PageHeader,
  Panel,
  Skeleton,
  StatusBadge
} from "@/components/wealth-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { CategoryValue, PortfolioSummary } from "@/types/finance";

export default function PortfolioPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [currency, setCurrency] = useState("GBP");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPortfolio() {
      try {
        const data = await apiFetch<PortfolioSummary>("portfolio/summary");
        if (active) {
          setSummary(data);
          setCurrency(data.primary_currency || "GBP");
          setError(null);
        }
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
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Portfolio"
            title="Portfolio Engine"
            subtitle="Asset categories, history, allocation, receipts, and goal progress."
            icon={<ChartPie className="h-5 w-5" aria-hidden="true" />}
            actions={
              <Link href="/assets/new" className={buttonPrimaryClass}>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                Add asset
              </Link>
            }
          />
          <FormMessage tone="error">{error}</FormMessage>
          {summary ? (
            <PortfolioContent summary={summary} currency={currency} onCurrencyChange={setCurrency} />
          ) : (
            <Skeleton className="h-56" />
          )}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function PortfolioContent({
  summary,
  currency,
  onCurrencyChange
}: {
  summary: PortfolioSummary;
  currency: string;
  onCurrencyChange: (currency: string) => void;
}) {
  const currencies = useMemo(
    () =>
      Array.from(
        new Set([
          "GBP",
          "USD",
          "NGN",
          "EUR",
          summary.primary_currency,
          ...summary.totals_by_currency.map((item) => item.currency),
          ...summary.allocation.map((item) => item.currency)
        ].filter(Boolean))
      ),
    [summary]
  );
  const allocation = summary.allocation.filter((item) => item.currency === currency);
  const total =
    summary.totals_by_currency.find((item) => item.currency === currency)?.total_value ??
    (currency === summary.primary_currency ? summary.total_assets : "0");
  const growth = summary.growth.filter((item) => item.currency === currency);

  return (
    <div className="space-y-5">
      <Panel
        title="Currency View"
        subtitle="Stored values remain grouped by currency."
        actions={<CurrencySelector value={currency} currencies={currencies} totals={summary.totals_by_currency} onChange={onCurrencyChange} />}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<Landmark className="h-5 w-5" />} label="Total Assets" value={formatMoney(total, currency)} />
          <MetricCard
            icon={<Banknote className="h-5 w-5" />}
            label="Tracked Savings"
            value={formatMoney(currency === summary.primary_currency ? summary.tracked_savings : "0", currency)}
          />
          <MetricCard icon={<PieChart className="h-5 w-5" />} label="Allocation Groups" value={String(allocation.filter((row) => Number(row.total_value) > 0).length)} />
          <MetricCard icon={<Target className="h-5 w-5" />} label="Goal Progress" value={`${summary.goal_progress_percentage}%`} />
        </div>
      </Panel>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Banknote className="h-5 w-5" />} label="Cash" value={valueFor(summary, allocation, "cash", currency, "cash")} />
        <MetricCard icon={<LineChart className="h-5 w-5" />} label="Investments" value={valueFor(summary, allocation, "investment", currency, "investments")} />
        <MetricCard icon={<Building2 className="h-5 w-5" />} label="Property" value={valueFor(summary, allocation, "property", currency, "property")} />
        <MetricCard icon={<Coins className="h-5 w-5" />} label="Crypto" value={valueFor(summary, allocation, "crypto", currency, "crypto")} />
        <MetricCard icon={<BriefcaseBusiness className="h-5 w-5" />} label="Business" value={valueFor(summary, allocation, "business", currency, "business")} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Trading Accounts" value={valueFor(summary, allocation, "trading_account", currency, "trading_accounts")} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Asset Allocation" icon={<PieChart className="h-5 w-5" aria-hidden="true" />}>
          <AllocationChart rows={allocation} />
        </Panel>
        <Panel title="Goal Progress" icon={<Target className="h-5 w-5" aria-hidden="true" />}>
          <GoalProgress progress={summary.goal_progress_percentage} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Portfolio Growth" icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}>
          <GrowthChart growth={growth} />
        </Panel>
        <Panel title="Totals By Currency">
          <div className="grid gap-2">
            {summary.totals_by_currency.map((item) => (
              <div key={item.currency} className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm">
                <span className="font-semibold">{item.currency}</span>
                <span>{formatMoney(item.total_value, item.currency)}</span>
              </div>
            ))}
            {!summary.totals_by_currency.length ? <EmptyState title="No portfolio values yet" /> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Recent Assets" icon={<BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />}>
          <div className="space-y-2">
            {summary.recent_assets.map((asset) => (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm hover:bg-[color:var(--owi-surface-hover)]"
              >
                <span className="min-w-0 truncate font-semibold">{asset.asset_name}</span>
                <span className="shrink-0">{formatMoney(asset.current_value, asset.currency)}</span>
              </Link>
            ))}
            {!summary.recent_assets.length ? <EmptyState title="No assets yet" /> : null}
          </div>
        </Panel>
        <Panel title="Recent Receipts" icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}>
          <div className="space-y-2">
            {summary.recent_receipts.map((receipt) => (
              <Link
                key={receipt.id}
                href="/receipts"
                className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm hover:bg-[color:var(--owi-surface-hover)]"
              >
                <span className="min-w-0 truncate font-semibold">{receipt.original_filename}</span>
                <StatusBadge status={receipt.media_type.split("/")[1] ?? "file"} />
              </Link>
            ))}
            {!summary.recent_receipts.length ? <EmptyState title="No receipts yet" /> : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function valueFor(
  summary: PortfolioSummary,
  allocation: CategoryValue[],
  category: string,
  currency: string,
  fallbackKey: "tracked_savings" | "cash" | "investments" | "crypto" | "property" | "business" | "trading_accounts"
) {
  const row = allocation.find((item) => item.category === category);
  if (row) return formatMoney(row.total_value, row.currency);
  if (currency !== summary.primary_currency) return formatMoney(0, currency);
  return formatMoney(summary[fallbackKey], currency);
}

function GrowthChart({ growth }: { growth: PortfolioSummary["growth"] }) {
  if (!growth.length) return <EmptyState title="No growth history" />;
  const max = Math.max(...growth.map((item) => Number(item.total_value)), 1);
  return (
    <div className="space-y-3">
      {growth.slice(-10).map((item) => (
        <div key={`${item.valuation_date}-${item.currency}-${item.total_value}`} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-[color:var(--owi-muted)]">{item.valuation_date}</span>
          <div className="h-3 overflow-hidden rounded-full bg-[color:var(--owi-surface-elevated)]">
            <div className="h-full rounded-full bg-moss dark:bg-mist" style={{ width: `${Math.max((Number(item.total_value) / max) * 100, 3)}%` }} />
          </div>
          <span className="text-right font-semibold">{formatMoney(item.total_value, item.currency)}</span>
        </div>
      ))}
    </div>
  );
}
