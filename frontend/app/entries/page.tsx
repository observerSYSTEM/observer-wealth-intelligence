"use client";

import { Pencil, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, statusLabel } from "@/lib/format";
import type { EntryList, WealthEntry } from "@/types/finance";

const LIMIT = 10;

export default function EntriesPage() {
  const [entries, setEntries] = useState<WealthEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [currency, setCurrency] = useState("");
  const [incomeSource, setIncomeSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadEntries() {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset)
      });
      if (currency) params.set("currency", currency);
      if (incomeSource) params.set("income_source", incomeSource);
      try {
        const data = await apiFetch<EntryList>(`/api/v1/entries?${params.toString()}`);
        if (active) {
          setEntries(data.items);
          setTotal(data.total);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadEntries();
    return () => {
      active = false;
    };
  }, [currency, incomeSource, offset]);

  async function deleteEntry(entryId: string) {
    if (!window.confirm("Delete this entry?")) return;
    await apiFetch(`/api/v1/entries/${entryId}`, { method: "DELETE" });
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    setTotal((current) => Math.max(0, current - 1));
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Entry History</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">{total} entries</p>
            </div>
            <Link
              href="/entries/new"
              className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white"
            >
              New entry
            </Link>
          </div>
          <FormMessage tone="error">{error}</FormMessage>
          <div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:grid-cols-2">
            <Field id="currency-filter" label="Currency">
              <select
                id="currency-filter"
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value);
                  setOffset(0);
                }}
                className={inputClass}
              >
                <option value="">All</option>
                <option value="GBP">GBP</option>
                <option value="USD">USD</option>
                <option value="NGN">NGN</option>
              </select>
            </Field>
            <Field id="source-filter" label="Income source">
              <select
                id="source-filter"
                value={incomeSource}
                onChange={(event) => {
                  setIncomeSource(event.target.value);
                  setOffset(0);
                }}
                className={inputClass}
              >
                <option value="">All</option>
                <option value="forex">Forex</option>
                <option value="business">Business</option>
                <option value="employment">Employment</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-white/5 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-mist/70 text-black/65 dark:bg-white/10 dark:text-white/70">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Actual saved</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="px-4 py-3">{entry.entry_date}</td>
                    <td className="px-4 py-3">{entry.income_source}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatMoney(entry.actual_savings, entry.currency)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                    <td className="px-4 py-3">{entry.receipt_id ? "Attached" : "None"}</td>
                    <td className="px-4 py-3">
                      <ActionButtons entry={entry} onDelete={deleteEntry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{entry.entry_date}</p>
                    <p className="text-sm text-black/60 dark:text-white/60">{entry.income_source}</p>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
                <p className="mt-3 text-xl font-semibold">
                  {formatMoney(entry.actual_savings, entry.currency)}
                </p>
                <ActionButtons entry={entry} onDelete={deleteEntry} />
              </div>
            ))}
          </div>

          {!entries.length ? (
            <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
              No entries match these filters.
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - LIMIT))}
              className="rounded-md border border-black/10 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/10"
            >
              Previous
            </button>
            <span className="text-sm text-black/60 dark:text-white/60">
              {offset + 1}-{Math.min(offset + LIMIT, total)} of {total}
            </span>
            <button
              type="button"
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset((current) => current + LIMIT)}
              className="rounded-md border border-black/10 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/10"
            >
              Next
            </button>
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "above_target" || status === "target_met"
      ? "bg-moss/10 text-moss dark:text-mist"
      : status === "below_target"
        ? "bg-copper/10 text-copper dark:text-[#ffb088]"
        : "bg-mist text-ink dark:bg-white/10 dark:text-white";
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{statusLabel(status)}</span>;
}

function ActionButtons({
  entry,
  onDelete
}: {
  entry: WealthEntry;
  onDelete: (entryId: string) => Promise<void>;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 md:mt-0">
      <Link
        href={`/entries/${entry.id}`}
        title="Edit entry"
        className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>
      {entry.receipt_id ? (
        <Link
          href="/receipts"
          title="Receipt attached"
          className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
        >
          <ReceiptText className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
      <button
        type="button"
        title="Delete entry"
        onClick={() => void onDelete(entry.id)}
        className="grid h-9 w-9 place-items-center rounded-md border border-black/10 hover:bg-mist dark:border-white/10 dark:hover:bg-white/10"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
