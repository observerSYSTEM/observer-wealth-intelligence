"use client";

import { Archive, ExternalLink, Plus, Target } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadGoals() {
    const data = await apiFetch<GoalList>("/api/v1/goals?limit=100");
    setGoals(data.items);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<GoalList>("/api/v1/goals?limit=100");
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

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<Goal>("/api/v1/goals", {
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
      await apiFetch<GoalContribution>(`/api/v1/goals/${goal.id}/contributions`, {
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

  async function archiveGoal(goalId: string) {
    if (!window.confirm("Archive this goal?")) return;
    await apiFetch(`/api/v1/goals/${goalId}`, { method: "DELETE" });
    setGoals((current) => current.filter((goal) => goal.id !== goalId));
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="grid gap-4 py-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form
            onSubmit={(event) => void createGoal(event)}
            className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Goals</h2>
            </div>
            <div className="mt-5 space-y-4">
              <FormMessage tone="success">{message}</FormMessage>
              <FormMessage tone="error">{error}</FormMessage>
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
                    {["GBP", "USD", "NGN", "EUR"].map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
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
                <Field id="goal-priority" label="Priority">
                  <input
                    id="goal-priority"
                    type="number"
                    min="1"
                    max="5"
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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
                <label className="flex items-center gap-3 pt-7 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.is_primary}
                    onChange={(event) => setForm({ ...form, is_primary: event.target.checked })}
                    className="h-4 w-4 accent-moss"
                  />
                  Primary goal
                </label>
              </div>
              <Field id="goal-notes" label="Notes">
                <textarea
                  id="goal-notes"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {saving ? "Saving" : "Create"}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {goals.map((goal) => (
              <article
                key={goal.id}
                className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{goal.name}</h3>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      {statusLabel(goal.category)} / {statusLabel(goal.progress_source)}
                      {goal.is_primary ? " / Primary" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/goals/${goal.id}`}
                      title="Open"
                      className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      title="Archive"
                      onClick={() => void archiveGoal(goal.id)}
                      className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="Saved" value={formatMoney(goal.current_amount, goal.currency)} />
                  <Metric label="Target" value={formatMoney(goal.target_amount, goal.currency)} />
                  <Metric label="Progress" value={formatPercent(goal.progress_percentage)} />
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-mist dark:bg-white/10">
                  <div
                    className="h-full bg-moss"
                    style={{ width: `${Math.min(Number(goal.progress_percentage), 100)}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={contributions[goal.id] ?? ""}
                    onChange={(event) =>
                      setContributions((current) => ({
                        ...current,
                        [goal.id]: event.target.value
                      }))
                    }
                    className={inputClass}
                    aria-label={`Contribution for ${goal.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => void addContribution(goal)}
                    className="rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold dark:border-white/10"
                  >
                    Add
                  </button>
                </div>
              </article>
            ))}
            {!goals.length ? (
              <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                No goals yet.
              </div>
            ) : null}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-mist p-3 text-sm dark:bg-white/10">
      <p className="text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
