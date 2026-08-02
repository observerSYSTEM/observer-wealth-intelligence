"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { WealthEntry } from "@/types/finance";

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<WealthEntry | null>(null);
  const [actualSavings, setActualSavings] = useState("");
  const [notes, setNotes] = useState("");
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadEntry() {
      try {
        const data = await apiFetch<WealthEntry>(`entries/${params.id}`);
        if (active) {
          setEntry(data);
          setActualSavings(data.actual_savings);
          setNotes(data.notes ?? "");
          setTransferConfirmed(data.transfer_confirmed);
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadEntry();
    return () => {
      active = false;
    };
  }, [params.id]);

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch<WealthEntry>(`entries/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          actual_savings: actualSavings,
          notes,
          transfer_confirmed: transferConfirmed,
          future_confirmed: true,
          duplicate_confirmed: true
        })
      });
      setEntry(updated);
      setMessage("Entry saved.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry() {
    if (!window.confirm("Delete this entry?")) return;
    await apiFetch(`entries/${params.id}`, { method: "DELETE" });
    router.replace("/entries");
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="py-6">
          {entry ? (
            <form
              onSubmit={saveEntry}
              className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 lg:grid-cols-[1fr_0.7fr]"
            >
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Entry {entry.entry_date}</h2>
                  <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                    Recorded {entry.recorded_at_local}
                  </p>
                </div>
                <FormMessage tone="success">{message}</FormMessage>
                <FormMessage tone="error">{error}</FormMessage>
                <Field id="actual-savings" label="Actual savings">
                  <input
                    id="actual-savings"
                    type="number"
                    step="0.01"
                    value={actualSavings}
                    onChange={(event) => setActualSavings(event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={transferConfirmed}
                    onChange={(event) => setTransferConfirmed(event.target.checked)}
                    className="h-4 w-4 accent-moss"
                  />
                  Transfer confirmed
                </label>
                <Field id="notes" label="Notes">
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={`${inputClass} min-h-28`}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Saving" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteEntry()}
                    className="rounded-md bg-copper px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <aside className="space-y-3 text-sm">
                <SummaryRow label="Profit" value={formatMoney(entry.realised_profit, entry.currency)} />
                <SummaryRow
                  label="Recommended savings"
                  value={formatMoney(entry.recommended_savings, entry.currency)}
                />
                <SummaryRow label="Variance" value={formatMoney(entry.savings_variance, entry.currency)} />
                <SummaryRow label="Score" value={entry.discipline_score?.toString() ?? "N/A"} />
                <SummaryRow label="Receipt" value={entry.receipt_id ? "Attached" : "None"} />
              </aside>
            </form>
          ) : (
            <FormMessage tone="error">{error}</FormMessage>
          )}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/10 py-2 dark:border-white/10">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
