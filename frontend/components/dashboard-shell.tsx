"use client";

import {
  Banknote,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartPie,
  Clock3,
  Coins,
  DatabaseBackup,
  Landmark,
  LineChart,
  PiggyBank,
  ReceiptText,
  ScanText,
  Target,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { ProtectedRoute } from "@/components/protected-route";
import {
  ActivityTimeline,
  AllocationChart,
  buttonPrimaryClass,
  buttonSecondaryClass,
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
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { CategoryValue, DashboardSummary } from "@/types/finance";

type SavingsPeriod = "daily" | "monthly";

export function DashboardShell() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("GBP");
  const [period, setPeriod] = useState<SavingsPeriod>("daily");

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      try {
        const data = await apiFetch<DashboardSummary>("/api/v1/dashboard/summary");
        if (active) {
          setSummary(data);
          setSelectedCurrency(data.tracked_savings_currency || "GBP");
          setError(null);
        }
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
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Dashboard 3.1"
            title="Wealth Control Centre"
            subtitle="Portfolio, savings, vault, OCR, goals, notifications, and backups."
            icon={<LayoutIcon />}
            actions={
              <>
                <Link href="/entries/new" className={buttonPrimaryClass}>
                  <PiggyBank className="h-4 w-4" aria-hidden="true" />
                  Daily entry
                </Link>
                <Link href="/assets/new" className={buttonSecondaryClass}>
                  <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                  Asset
                </Link>
                <Link href="/goals/new" className={buttonSecondaryClass}>
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Goal
                </Link>
              </>
            }
          />

          {error ? (
            <p className="rounded-md border border-copper/30 bg-copper/10 px-3 py-2 text-sm font-medium text-copper dark:text-[#ffb088]">
              {error}
            </p>
          ) : null}

          {summary ? (
            <DashboardContent
              summary={summary}
              selectedCurrency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
              period={period}
              onPeriodChange={setPeriod}
            />
          ) : (
            <DashboardSkeleton />
          )}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function DashboardContent({
  summary,
  selectedCurrency,
  onCurrencyChange,
  period,
  onPeriodChange
}: {
  summary: DashboardSummary;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  period: SavingsPeriod;
  onPeriodChange: (period: SavingsPeriod) => void;
}) {
  const currencies = useMemo(
    () =>
      Array.from(
        new Set([
          "GBP",
          "USD",
          "NGN",
          "EUR",
          summary.tracked_savings_currency,
          ...summary.savings_by_currency.map((item) => item.currency),
          ...summary.asset_allocation.map((item) => item.currency)
        ].filter(Boolean))
      ),
    [summary]
  );
  const selectedSavings =
    summary.savings_by_currency.find((item) => item.currency === selectedCurrency)
      ?.total_actual_savings ?? (selectedCurrency === summary.tracked_savings_currency ? summary.tracked_savings : "0");
  const selectedAllocation = allocationForCurrency(summary.asset_allocation, selectedCurrency);
  const totalForCurrency =
    selectedAllocation.reduce((total, row) => total + Number(row.total_value), 0) ||
    (selectedCurrency === summary.tracked_savings_currency ? Number(summary.total_assets) : 0);
  const primaryGoal = summary.active_goals.find((goal) => goal.is_primary) ?? summary.active_goals[0];
  const savingsData = period === "daily" ? summary.daily_savings : summary.monthly_savings;

  return (
    <div className="space-y-5">
      <Panel
        title="Currency Groups"
        subtitle="Amounts stay grouped by stored currency. No FX conversion is applied."
        actions={
          <CurrencySelector
            value={selectedCurrency}
            currencies={currencies}
            totals={summary.savings_by_currency}
            onChange={onCurrencyChange}
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Landmark className="h-5 w-5" />}
            label="Total Assets"
            value={formatMoney(totalForCurrency, selectedCurrency)}
            detail={selectedCurrency}
          />
          <MetricCard
            icon={<PiggyBank className="h-5 w-5" />}
            label="Tracked Savings"
            value={formatMoney(selectedSavings, selectedCurrency)}
            detail={`${formatMoney(summary.savings_this_month, summary.tracked_savings_currency)} this month`}
            tone="positive"
          />
          <MetricCard
            icon={<Target className="h-5 w-5" />}
            label="Goal Progress"
            value={formatPercent(primaryGoal?.progress_percentage ?? summary.goal_progress_percentage)}
            detail={primaryGoal?.name ?? "Primary goal"}
            tone="info"
          />
          <MetricCard
            icon={<ScanText className="h-5 w-5" />}
            label="OCR Reviews"
            value={String(summary.pending_ocr_reviews)}
            detail={`${summary.unread_notifications} notifications unread`}
            tone={summary.pending_ocr_reviews > 0 ? "warning" : "neutral"}
          />
        </div>
      </Panel>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Banknote className="h-5 w-5" />} label="Cash" value={categoryValue(summary, selectedAllocation, "cash", selectedCurrency)} />
        <MetricCard icon={<LineChart className="h-5 w-5" />} label="Investments" value={categoryValue(summary, selectedAllocation, "investment", selectedCurrency)} />
        <MetricCard icon={<Building2 className="h-5 w-5" />} label="Property" value={categoryValue(summary, selectedAllocation, "property", selectedCurrency)} />
        <MetricCard icon={<Coins className="h-5 w-5" />} label="Crypto" value={categoryValue(summary, selectedAllocation, "crypto", selectedCurrency)} />
        <MetricCard icon={<BriefcaseBusiness className="h-5 w-5" />} label="Business" value={categoryValue(summary, selectedAllocation, "business", selectedCurrency)} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Trading Accounts" value={categoryValue(summary, selectedAllocation, "trading_account", selectedCurrency)} />
        <MetricCard icon={<TrendingUp className="h-5 w-5" />} label="Streak" value={`${summary.current_streak} days`} detail={`Best ${summary.longest_streak}`} />
        <MetricCard
          icon={<DatabaseBackup className="h-5 w-5" />}
          label="Latest Backup"
          value={summary.latest_backup?.restore_verified ? "Verified" : summary.latest_backup?.status ? statusLabel(summary.latest_backup.status) : "None"}
          tone={summary.latest_backup?.restore_verified ? "positive" : "neutral"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Asset Allocation" icon={<ChartPie className="h-5 w-5" aria-hidden="true" />}>
          <AllocationChart rows={selectedAllocation} />
        </Panel>
        <Panel title="Goal Progress" icon={<Target className="h-5 w-5" aria-hidden="true" />}>
          <GoalProgress
            goal={primaryGoal}
            progress={summary.goal_progress_percentage}
            amountLabel={formatMoney(summary.tracked_savings, summary.tracked_savings_currency)}
            targetLabel={formatMoney(summary.primary_goal_amount, summary.primary_goal_currency)}
          />
          <div className="mt-5 grid gap-2">
            {summary.active_goals.slice(0, 3).map((goal) => (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm hover:bg-[color:var(--owi-surface-hover)]"
              >
                <span className="min-w-0 truncate font-semibold">{goal.name}</span>
                <span className="shrink-0 text-[color:var(--owi-muted)]">{formatPercent(goal.progress_percentage)}</span>
              </Link>
            ))}
            {!summary.active_goals.length ? <EmptyState title="No active goals" /> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Portfolio Growth" icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}>
          <PortfolioGrowthChart data={summary.portfolio_growth.filter((item) => item[1] === selectedCurrency)} />
        </Panel>
        <Panel
          title="Savings Activity"
          icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
          actions={
            <div className="flex rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-1">
              {(["daily", "monthly"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPeriodChange(item)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${
                    period === item ? "bg-moss text-white dark:bg-mist dark:text-ink" : "text-[color:var(--owi-muted)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          }
        >
          <SavingsChart data={savingsData} currency={summary.tracked_savings_currency} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Recent Timeline" icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}>
          <ActivityTimeline items={summary.recent_timeline} emptyTitle="No recent timeline events" />
        </Panel>
        <div className="space-y-5">
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
                  <StatusBadge status={receipt.media_type.split("/")[1] ?? "file"} tone="neutral" />
                </Link>
              ))}
              {!summary.recent_receipts.length ? <EmptyState title="No receipts yet" /> : null}
            </div>
          </Panel>
          <Panel title="Recent Notifications" icon={<Bell className="h-5 w-5" aria-hidden="true" />}>
            <div className="space-y-2">
              {summary.recent_notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href="/notifications"
                  className="block rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm hover:bg-[color:var(--owi-surface-hover)]"
                >
                  <span className="block truncate font-semibold">{notification.title}</span>
                  <span className="mt-1 block text-[color:var(--owi-muted)]">{statusLabel(notification.status)}</span>
                </Link>
              ))}
              {!summary.recent_notifications.length ? <EmptyState title="No notifications yet" /> : null}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function LayoutIcon() {
  return <Landmark className="h-5 w-5" aria-hidden="true" />;
}

function allocationForCurrency(rows: CategoryValue[], currency: string) {
  return rows.filter((row) => row.currency === currency);
}

function categoryValue(summary: DashboardSummary, rows: CategoryValue[], category: string, currency: string) {
  const row = rows.find((item) => item.category === category && item.currency === currency);
  if (row) return formatMoney(row.total_value, row.currency);
  if (currency !== summary.tracked_savings_currency) return formatMoney(0, currency);
  const fallback: Record<string, string> = {
    cash: summary.cash,
    investment: summary.investments,
    crypto: summary.crypto,
    property: summary.property,
    business: summary.business,
    trading_account: summary.trading_accounts
  };
  return formatMoney(fallback[category] ?? "0", currency);
}

function PortfolioGrowthChart({ data }: { data: Array<[string, string, string]> }) {
  if (!data.length) return <EmptyState title="No growth history" />;
  const max = Math.max(...data.map(([, , value]) => Number(value)), 1);
  return (
    <div className="space-y-3">
      {data.slice(-10).map(([date, currency, value]) => (
        <div key={`${date}-${currency}-${value}`} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-[color:var(--owi-muted)]">{date}</span>
          <div className="h-3 overflow-hidden rounded-full bg-[color:var(--owi-surface-elevated)]">
            <div className="h-full rounded-full bg-moss dark:bg-mist" style={{ width: `${Math.max((Number(value) / max) * 100, 3)}%` }} />
          </div>
          <span className="text-right font-semibold">{formatMoney(value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

function SavingsChart({ data, currency }: { data: Array<[string, string]>; currency: string }) {
  if (!data.length) return <EmptyState title="No savings history" />;
  const max = Math.max(...data.map(([, value]) => Number(value)), 1);
  return (
    <div className="space-y-3">
      {data.slice(-12).map(([label, value]) => (
        <div key={label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-[color:var(--owi-muted)]">{label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-[color:var(--owi-surface-elevated)]">
            <div className="h-full rounded-full bg-moss dark:bg-mist" style={{ width: `${Math.max((Number(value) / max) * 100, 3)}%` }} />
          </div>
          <span className="text-right font-semibold">{formatMoney(value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-32" />
      ))}
    </div>
  );
}
