"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { AppSettings } from "@/types/auth";
import type { WealthEntry } from "@/types/finance";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export default function NewEntryPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [entryDate, setEntryDate] = useState(todayIso());
  const [incomeSource, setIncomeSource] = useState("forex");
  const [currency, setCurrency] = useState("GBP");
  const [realisedProfit, setRealisedProfit] = useState("0.00");
  const [actualSavings, setActualSavings] = useState("0.00");
  const [actualBusiness, setActualBusiness] = useState("0.00");
  const [actualLiving, setActualLiving] = useState("0.00");
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadedReceiptId, setUploadedReceiptId] = useState<string | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [futureConfirmed, setFutureConfirmed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      try {
        const data = await apiFetch<AppSettings>("/api/v1/settings");
        if (active) setSettings(data);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const preview = useMemo(() => {
    const profit = Number(realisedProfit) || 0;
    const savings = profit > 0 ? roundMoney((profit * (settings?.savings_percentage ?? 50)) / 100) : 0;
    const business = profit > 0 ? roundMoney((profit * (settings?.business_percentage ?? 30)) / 100) : 0;
    const living = profit > 0 ? roundMoney((profit * (settings?.living_percentage ?? 20)) / 100) : 0;
    return { savings, business, living };
  }, [realisedProfit, settings]);

  const isFutureEntry = entryDate > todayIso();

  async function saveEntry() {
    setSaving(true);
    setError(null);
    try {
      let receiptId = uploadedReceiptId;
      if (receiptFile && !receiptId) {
        const form = new FormData();
        form.append("receipt", receiptFile);
        const receipt = await apiFetch<{ id: string }>("/api/v1/receipts", {
          method: "POST",
          body: form
        });
        receiptId = receipt.id;
        setUploadedReceiptId(receipt.id);
      }

      const entry = await apiFetch<WealthEntry>("/api/v1/entries", {
        method: "POST",
        body: JSON.stringify({
          entry_date: entryDate,
          income_source: incomeSource,
          realised_profit: realisedProfit,
          currency,
          actual_savings: actualSavings,
          actual_business: actualBusiness,
          actual_living: actualLiving,
          transfer_confirmed: transferConfirmed,
          notes,
          receipt_id: receiptId,
          duplicate_confirmed: duplicateConfirmed,
          future_confirmed: isFutureEntry ? futureConfirmed : false,
          idempotency_key: idempotencyKey
        })
      });
      router.replace(`/entries/${entry.id}`);
    } catch (saveError) {
      const message = errorMessage(saveError);
      setError(message);
      if (message.toLowerCase().includes("already exists")) {
        setDuplicateConfirmed(true);
      }
      setReviewing(false);
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewing(true);
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <form onSubmit={onSubmit} className="grid gap-4 py-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div>
              <h2 className="text-lg font-semibold">New Entry</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Record realised profit and actual saved amount.
              </p>
            </div>
            <FormMessage tone="error">{error}</FormMessage>
            {duplicateConfirmed ? (
              <FormMessage tone="success">
                Duplicate forex date acknowledged. Submit again to save.
              </FormMessage>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="realised-profit" label="Realised profit">
                <input
                  id="realised-profit"
                  type="number"
                  step="0.01"
                  value={realisedProfit}
                  onChange={(event) => setRealisedProfit(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field id="currency" label="Currency">
                <select
                  id="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className={inputClass}
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="NGN">NGN</option>
                  <option value="EUR">EUR</option>
                </select>
              </Field>
              <Field id="income-source" label="Income source">
                <select
                  id="income-source"
                  value={incomeSource}
                  onChange={(event) => setIncomeSource(event.target.value)}
                  className={inputClass}
                >
                  <option value="forex">Forex</option>
                  <option value="business">Business</option>
                  <option value="employment">Employment</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field id="entry-date" label="Entry date">
                <input
                  id="entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(event) => {
                    setEntryDate(event.target.value);
                    setDuplicateConfirmed(false);
                    setFutureConfirmed(false);
                  }}
                  className={inputClass}
                />
              </Field>
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
              <Field id="actual-business" label="Actual business">
                <input
                  id="actual-business"
                  type="number"
                  step="0.01"
                  value={actualBusiness}
                  onChange={(event) => setActualBusiness(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field id="actual-living" label="Actual living">
                <input
                  id="actual-living"
                  type="number"
                  step="0.01"
                  value={actualLiving}
                  onChange={(event) => setActualLiving(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field id="receipt" label="Receipt or screenshot">
                <input
                  id="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => {
                    setReceiptFile(event.target.files?.[0] ?? null);
                    setUploadedReceiptId(null);
                  }}
                  className={inputClass}
                />
              </Field>
            </div>
            {isFutureEntry ? (
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={futureConfirmed}
                  onChange={(event) => setFutureConfirmed(event.target.checked)}
                  className="h-4 w-4 accent-moss"
                />
                Confirm future-dated entry
              </label>
            ) : null}
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
                className={`${inputClass} min-h-24`}
              />
            </Field>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Review entry
            </button>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h3 className="text-lg font-semibold">Allocation Preview</h3>
              <div className="mt-4 space-y-3 text-sm">
                <PreviewRow label="Savings" value={formatMoney(preview.savings, currency)} />
                <PreviewRow label="Business" value={formatMoney(preview.business, currency)} />
                <PreviewRow label="Living" value={formatMoney(preview.living, currency)} />
              </div>
            </section>
            {reviewing ? (
              <section className="rounded-lg border border-moss/30 bg-moss/10 p-5">
                <h3 className="text-lg font-semibold">Final Review</h3>
                <p className="mt-2 text-sm text-black/70 dark:text-white/70">
                  Save {formatMoney(actualSavings, currency)} actual savings for {entryDate}.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEntry()}
                  className="mt-4 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving" : "Save entry"}
                </button>
              </section>
            ) : null}
          </aside>
        </form>
      </AppFrame>
    </ProtectedRoute>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-2 last:border-b-0 dark:border-white/10">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
