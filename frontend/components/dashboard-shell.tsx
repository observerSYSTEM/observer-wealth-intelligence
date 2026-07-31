"use client";

import { CalendarDays, LineChart, PiggyBank, Plus, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
              Tracked Savings, not total net worth.
            </p>
          </div>
          <Link
            href="/entries/new"
            className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New entry
          </Link>
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
          label="Tracked savings"
          value={formatMoney(summary.tracked_savings, currency)}
        />
        <MetricCard
          icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
          label="This month"
          value={formatMoney(summary.savings_this_month, currency)}
        />
        <MetricCard
          icon={<Target className="h-5 w-5" aria-hidden="true" />}
          label="Goal progress"
          value={formatPercent(summary.goal_progress_percentage)}
        />
        <MetricCard
          icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
          label="Saving streak"
          value={`${summary.current_streak} days`}
        />
        <MetricCard
          icon={<LineChart className="h-5 w-5" aria-hidden="true" />}
          label="Average score"
          value={summary.average_discipline_score ?? "No score"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Daily savings">
          <BarChart data={summary.daily_savings} currency={currency} />
        </Panel>
        <Panel title="Monthly savings">
          <BarChart data={summary.monthly_savings} currency={currency} />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <Panel title="Latest entries">
          {summary.latest_entries.length ? (
            <div className="space-y-3">
              {summary.latest_entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/entries/${entry.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 text-sm transition hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                >
                  <div>
                    <p className="font-medium">{entry.entry_date}</p>
                    <p className="text-black/60 dark:text-white/60">
                      {entry.income_source} · {statusLabel(entry.status)}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {formatMoney(entry.actual_savings, entry.currency)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No entries yet. Create your first savings record." />
          )}
        </Panel>

        <Panel title="Goal">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-black/60 dark:text-white/60">Primary goal</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatMoney(summary.primary_goal_amount, summary.primary_goal_currency)}
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
              <div
                className="h-full bg-moss"
                style={{ width: `${Math.min(Number(summary.goal_progress_percentage), 100)}%` }}
              />
            </div>
            <p className="text-sm text-black/60 dark:text-white/60">
              Only {summary.primary_goal_currency} entries count toward this milestone goal.
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-mist text-ink dark:bg-white/10 dark:text-white">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BarChart({ data, currency }: { data: Array<[string, string]>; currency: string }) {
  if (!data.length) {
    return <EmptyState message="No chart data yet." />;
  }
  const max = Math.max(...data.map(([, value]) => Number(value)), 1);
  return (
    <div className="space-y-3">
      {data.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[6.5rem_1fr_5rem] items-center gap-3 text-sm">
          <span className="truncate text-black/60 dark:text-white/60">{label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
            <div
              className="h-full bg-moss"
              style={{ width: `${Math.max((Number(value) / max) * 100, 3)}%` }}
            />
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
    <div className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-32 animate-pulse rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-white/5"
        />
      ))}
    </div>
  );
}
