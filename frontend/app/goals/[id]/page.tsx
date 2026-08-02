"use client";

import { Archive, Plus, Target, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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
import { formatMoney, statusLabel } from "@/lib/format";
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
  const [deleteContributionId, setDeleteContributionId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadGoal() {
    const [goalData, contributionData] = await Promise.all([
      apiFetch<Goal>(`goals/${params.id}`),
      apiFetch<ContributionList>(`goals/${params.id}/contributions`)
    ]);
    setGoal(goalData);
    setContributions(contributionData.items);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [goalData, contributionData] = await Promise.all([
          apiFetch<Goal>(`goals/${params.id}`),
          apiFetch<ContributionList>(`goals/${params.id}/contributions`)
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
      await apiFetch<GoalContribution>(`goals/${goal.id}/contributions`, {
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

  async function deleteContribution() {
    if (!goal || !deleteContributionId) return;
    setError(null);
    try {
      await apiFetch(`goals/${goal.id}/contributions/${deleteContributionId}`, {
        method: "DELETE"
      });
      setDeleteContributionId(null);
      await loadGoal();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  async function archiveGoal() {
    if (!goal) return;
    setError(null);
    try {
      await apiFetch(`goals/${goal.id}`, { method: "DELETE" });
      router.replace("/goals");
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          {goal ? (
            <>
              <PageHeader
                eyebrow={statusLabel(goal.category)}
                title={goal.name}
                subtitle={`${statusLabel(goal.progress_source)} / ${statusLabel(goal.status)}`}
                icon={<Target className="h-5 w-5" aria-hidden="true" />}
                actions={
                  <button type="button" onClick={() => setArchiveOpen(true)} className={buttonSecondaryClass}>
                    <Archive className="h-4 w-4" aria-hidden="true" />
                    Archive
                  </button>
                }
              />

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Current" value={formatMoney(goal.current_amount, goal.currency)} />
                <MetricCard label="Target" value={formatMoney(goal.target_amount, goal.currency)} />
                <MetricCard label="Remaining" value={formatMoney(goal.remaining_amount, goal.currency)} />
                <MetricCard label="Monthly Estimate" value={goal.estimated_monthly_contribution ? formatMoney(goal.estimated_monthly_contribution, goal.currency) : "None"} />
              </section>

              <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
                <div className="space-y-5">
                  <Panel
                    title="Progress"
                    icon={<Target className="h-5 w-5" aria-hidden="true" />}
                    actions={
                      <div className="flex gap-2">
                        {goal.is_primary ? <StatusBadge status="primary" tone="info" /> : null}
                        <StatusBadge status={goal.status} />
                      </div>
                    }
                  >
                    <GoalProgress goal={goal} />
                    {goal.notes ? (
                      <p className="mt-5 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm leading-6 text-[color:var(--owi-muted)]">
                        {goal.notes}
                      </p>
                    ) : null}
                  </Panel>

                  <Panel title="Add Contribution" icon={<Plus className="h-5 w-5" aria-hidden="true" />}>
                    <form onSubmit={(event) => void addContribution(event)} className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
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
                            onChange={(event) => setForm({ ...form, contribution_date: event.target.value })}
                            className={inputClass}
                          />
                        </Field>
                      </div>
                      <Field id="goal-detail-notes" label="Notes">
                        <input
                          id="goal-detail-notes"
                          value={form.notes}
                          onChange={(event) => setForm({ ...form, notes: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <button type="submit" disabled={busy} className={buttonPrimaryClass}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add
                      </button>
                    </form>
                  </Panel>
                </div>

                <Panel title="Contribution History">
                  <div className="space-y-3">
                    {contributions.map((contribution) => (
                      <article
                        key={contribution.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{formatMoney(contribution.amount, contribution.currency)}</p>
                          <p className="mt-1 text-[color:var(--owi-muted)]">
                            {contribution.contribution_date} / {statusLabel(contribution.source_type)}
                          </p>
                          {contribution.notes ? (
                            <p className="mt-1 text-[color:var(--owi-muted)]">{contribution.notes}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          title="Delete contribution"
                          onClick={() => setDeleteContributionId(contribution.id)}
                          className={buttonSecondaryClass}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </article>
                    ))}
                    {!contributions.length ? <EmptyState title="No contributions yet" /> : null}
                  </div>
                </Panel>
              </div>

              <ConfirmDialog
                open={archiveOpen}
                title="Archive goal"
                message="This removes the goal from the active goal list."
                confirmLabel="Archive"
                onConfirm={() => void archiveGoal()}
                onCancel={() => setArchiveOpen(false)}
              />
              <ConfirmDialog
                open={deleteContributionId !== null}
                title="Delete contribution"
                message="This removes the contribution from this goal history."
                confirmLabel="Delete"
                onConfirm={() => void deleteContribution()}
                onCancel={() => setDeleteContributionId(null)}
              />
            </>
          ) : null}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
