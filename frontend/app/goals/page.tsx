"use client";

import { Archive, ExternalLink, Plus, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  ConfirmDialog,
  EmptyState,
  GoalProgress,
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge
} from "@/components/wealth-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { Goal, GoalContribution, GoalList } from "@/types/finance";

const categories = [
  "emergency_fund",
  "house",
  "land",
  "relocation",
  "business",
  "education",
  "investment",
  "family",
  "vehicle",
  "retirement",
  "other"
];

const progressSources = ["manual", "tracked_savings", "linked_assets"];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "other",
    currency: "GBP",
    target_amount: "",
    starting_amount: "0.00",
    deadline: "",
    priority: "3",
    progress_source: "manual",
    is_primary: false,
    notes: ""
  });
  const [contributions, setContributions] = useState<Record<string, string>>({});
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadGoals() {
    const data = await apiFetch<GoalList>("goals?limit=100");
    setGoals(data.items);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<GoalList>("goals?limit=100");
        if (active) setGoals(data.items);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const primaryGoal = useMemo(() => goals.find((goal) => goal.is_primary) ?? goals[0], [goals]);
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter((goal) => goal.status === "completed");

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<Goal>("goals", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          description: form.description || null,
          deadline: form.deadline || null,
          notes: form.notes || null,
          priority: Number(form.priority),
          is_primary: form.is_primary
        })
      });
      setForm({
        name: "",
        description: "",
        category: "other",
        currency: "GBP",
        target_amount: "",
        starting_amount: "0.00",
        deadline: "",
        priority: "3",
        progress_source: "manual",
        is_primary: false,
        notes: ""
      });
      setMessage("Goal created.");
      await loadGoals();
    } catch (goalError) {
      setError(errorMessage(goalError));
    } finally {
      setSaving(false);
    }
  }

  async function addContribution(goal: Goal) {
    const amount = contributions[goal.id];
    if (!amount) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch<GoalContribution>(`goals/${goal.id}/contributions`, {
        method: "POST",
        body: JSON.stringify({ amount, currency: goal.currency })
      });
      setContributions((current) => ({ ...current, [goal.id]: "" }));
      setMessage("Contribution added.");
      await loadGoals();
    } catch (contributionError) {
      setError(errorMessage(contributionError));
    }
  }

  async function archiveGoal() {
    if (!archiveId) return;
    setError(null);
    try {
      await apiFetch(`goals/${archiveId}`, { method: "DELETE" });
      setGoals((current) => current.filter((goal) => goal.id !== archiveId));
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
            eyebrow="Goals"
            title="Wealth Goals"
            subtitle="Track multiple goals, contribution history, and primary progress."
            icon={<Target className="h-5 w-5" aria-hidden="true" />}
            actions={
              <Link href="/goals/new" className={buttonPrimaryClass}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New goal
              </Link>
            }
          />
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Goals" value={String(goals.length)} icon={<Target className="h-5 w-5" />} />
            <MetricCard label="Active" value={String(activeGoals.length)} icon={<TrendingUp className="h-5 w-5" />} tone="positive" />
            <MetricCard label="Completed" value={String(completedGoals.length)} icon={<Target className="h-5 w-5" />} />
            <MetricCard
              label="Primary Progress"
              value={primaryGoal ? formatPercent(primaryGoal.progress_percentage) : "0.00%"}
              icon={<Target className="h-5 w-5" />}
              detail={primaryGoal?.name}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-5">
              <Panel title="Create Goal" icon={<Plus className="h-5 w-5" aria-hidden="true" />}>
                <form onSubmit={(event) => void createGoal(event)} className="space-y-4">
                  <Field id="goal-name" label="Name">
                    <input
                      id="goal-name"
                      required
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="goal-description" label="Description">
                    <textarea
                      id="goal-description"
                      value={form.description}
                      onChange={(event) => setForm({ ...form, description: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="goal-category" label="Category">
                      <select
                        id="goal-category"
                        value={form.category}
                        onChange={(event) => setForm({ ...form, category: event.target.value })}
                        className={inputClass}
                      >
                        {categories.map((item) => (
                          <option key={item} value={item}>
                            {statusLabel(item)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="goal-currency" label="Currency">
                      <select
                        id="goal-currency"
                        value={form.currency}
                        onChange={(event) => setForm({ ...form, currency: event.target.value })}
                        className={inputClass}
                      >
                        {["GBP", "USD", "NGN", "EUR"].map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="goal-target" label="Target amount">
                      <input
                        id="goal-target"
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.target_amount}
                        onChange={(event) => setForm({ ...form, target_amount: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field id="goal-current" label="Starting amount">
                      <input
                        id="goal-current"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.starting_amount}
                        onChange={(event) => setForm({ ...form, starting_amount: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="goal-date" label="Deadline">
                      <input
                        id="goal-date"
                        type="date"
                        value={form.deadline}
                        onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field id="goal-source" label="Progress source">
                      <select
                        id="goal-source"
                        value={form.progress_source}
                        onChange={(event) => setForm({ ...form, progress_source: event.target.value })}
                        className={inputClass}
                      >
                        {progressSources.map((item) => (
                          <option key={item} value={item}>
                            {statusLabel(item)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.is_primary}
                      onChange={(event) => setForm({ ...form, is_primary: event.target.checked })}
                      className="h-4 w-4 accent-moss"
                    />
                    Primary goal
                  </label>
                  <Field id="goal-notes" label="Notes">
                    <textarea
                      id="goal-notes"
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <button type="submit" disabled={saving} className={buttonPrimaryClass}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {saving ? "Saving" : "Create"}
                  </button>
                </form>
              </Panel>
              <Panel title="Primary Goal" icon={<Target className="h-5 w-5" aria-hidden="true" />}>
                {primaryGoal ? <GoalProgress goal={primaryGoal} /> : <EmptyState title="No primary goal" />}
              </Panel>
            </div>

            <div className="space-y-3">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  contribution={contributions[goal.id] ?? ""}
                  onContributionChange={(amount) =>
                    setContributions((current) => ({
                      ...current,
                      [goal.id]: amount
                    }))
                  }
                  onContribution={() => void addContribution(goal)}
                  onArchive={() => setArchiveId(goal.id)}
                />
              ))}
              {!goals.length ? <EmptyState title="No goals yet" message="Create a goal to start tracking progress." /> : null}
            </div>
          </div>

          <ConfirmDialog
            open={archiveId !== null}
            title="Archive goal"
            message="This removes the goal from the active goal list."
            confirmLabel="Archive"
            onConfirm={() => void archiveGoal()}
            onCancel={() => setArchiveId(null)}
          />
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function GoalCard({
  goal,
  contribution,
  onContributionChange,
  onContribution,
  onArchive
}: {
  goal: Goal;
  contribution: string;
  onContributionChange: (amount: string) => void;
  onContribution: () => void;
  onArchive: () => void;
}) {
  return (
    <article className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{goal.name}</h2>
            {goal.is_primary ? <StatusBadge status="primary" tone="info" /> : null}
            <StatusBadge status={goal.status} />
          </div>
          <p className="mt-1 text-sm text-[color:var(--owi-muted)]">
            {statusLabel(goal.category)} / {statusLabel(goal.progress_source)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/goals/${goal.id}`} title="Open" className={buttonSecondaryClass}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button type="button" title="Archive" onClick={onArchive} className={buttonSecondaryClass}>
            <Archive className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Saved" value={formatMoney(goal.current_amount, goal.currency)} />
        <Metric label="Target" value={formatMoney(goal.target_amount, goal.currency)} />
        <Metric label="Remaining" value={formatMoney(goal.remaining_amount, goal.currency)} />
      </div>
      <div className="mt-4">
        <GoalProgress goal={goal} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={contribution}
          onChange={(event) => onContributionChange(event.target.value)}
          className={inputClass}
          aria-label={`Contribution for ${goal.name}`}
        />
        <button type="button" onClick={onContribution} className={buttonSecondaryClass}>
          Add
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm">
      <p className="text-[color:var(--owi-muted)]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
