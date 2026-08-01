"use client";

import { Archive, Plus, Target, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { Goal, GoalContribution } from "@/types/finance";

type ContributionList = {
  items: GoalContribution[];
  total: number;
};

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [form, setForm] = useState({ amount: "", contribution_date: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadGoal() {
    const [goalData, contributionData] = await Promise.all([
      apiFetch<Goal>(`/api/v1/goals/${params.id}`),
      apiFetch<ContributionList>(`/api/v1/goals/${params.id}/contributions`)
    ]);
    setGoal(goalData);
    setContributions(contributionData.items);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [goalData, contributionData] = await Promise.all([
          apiFetch<Goal>(`/api/v1/goals/${params.id}`),
          apiFetch<ContributionList>(`/api/v1/goals/${params.id}/contributions`)
        ]);
        if (active) {
          setGoal(goalData);
          setContributions(contributionData.items);
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params.id]);

  async function addContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<GoalContribution>(`/api/v1/goals/${goal.id}/contributions`, {
        method: "POST",
        body: JSON.stringify({
          amount: form.amount,
          currency: goal.currency,
          contribution_date: form.contribution_date || null,
          notes: form.notes || null
        })
      });
      setForm({ amount: "", contribution_date: "", notes: "" });
      setMessage("Contribution added.");
      await loadGoal();
    } catch (contributionError) {
      setError(errorMessage(contributionError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteContribution(contributionId: string) {
    if (!goal) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/goals/${goal.id}/contributions/${contributionId}`, {
        method: "DELETE"
      });
      await loadGoal();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  async function archiveGoal() {
    if (!goal || !window.confirm("Archive this goal?")) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/goals/${goal.id}`, { method: "DELETE" });
      router.replace("/goals");
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          {goal ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-mist text-ink dark:bg-white/10 dark:text-white">
                    <Target className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold">{goal.name}</h2>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      {statusLabel(goal.category)} / {statusLabel(goal.status)}
                      {goal.is_primary ? " / Primary" : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void archiveGoal()}
                  className="inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  Archive
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Current" value={formatMoney(goal.current_amount, goal.currency)} />
                <Metric label="Target" value={formatMoney(goal.target_amount, goal.currency)} />
                <Metric label="Remaining" value={formatMoney(goal.remaining_amount, goal.currency)} />
                <Metric label="Progress" value={formatPercent(goal.progress_percentage)} />
              </div>

              <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <h3 className="font-semibold">Contribution History</h3>
                <form onSubmit={(event) => void addContribution(event)} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]">
                  <Field id="goal-detail-amount" label="Amount">
                    <input
                      id="goal-detail-amount"
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={(event) => setForm({ ...form, amount: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="goal-detail-date" label="Date">
                    <input
                      id="goal-detail-date"
                      type="date"
                      value={form.contribution_date}
                      onChange={(event) =>
                        setForm({ ...form, contribution_date: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field id="goal-detail-notes" label="Notes">
                    <input
                      id="goal-detail-notes"
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add
                  </button>
                </form>
                <div className="mt-4 space-y-2">
                  {contributions.map((contribution) => (
                    <div
                      key={contribution.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/10 p-3 text-sm dark:border-white/10"
                    >
                      <div>
                        <span className="font-medium">
                          {formatMoney(contribution.amount, contribution.currency)}
                        </span>
                        <span className="ml-2 text-black/60 dark:text-white/60">
                          {contribution.contribution_date}
                        </span>
                        {contribution.notes ? (
                          <span className="ml-2 text-black/60 dark:text-white/60">
                            {contribution.notes}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        title="Delete contribution"
                        onClick={() => void deleteContribution(contribution.id)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {!contributions.length ? (
                    <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                      No contributions yet.
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <p className="text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
