"use client";

import { CheckCircle2, FileText, PiggyBank, ReceiptText, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cn,
  FileUploader,
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge
} from "@/components/wealth-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { uploadReceiptFile } from "@/lib/uploads";
import type { AppSettings } from "@/types/auth";
import type { WealthEntry } from "@/types/finance";

type Step = "details" | "allocation" | "review" | "success";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function createIdempotencyKey() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function traceDailyEntry(message: string, details?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const enabled =
    process.env.NODE_ENV === "development" ||
    window.localStorage.getItem("owi:debug-events") === "true";
  if (enabled) {
    console.info(`[OWI Daily Entry] ${message}`, details ?? {});
  }
}

export default function NewEntryPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [step, setStep] = useState<Step>("details");
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedEntry, setSavedEntry] = useState<WealthEntry | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      try {
        const data = await apiFetch<AppSettings>("settings");
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

  const actualTotal =
    (Number(actualSavings) || 0) + (Number(actualBusiness) || 0) + (Number(actualLiving) || 0);
  const isFutureEntry = entryDate > todayIso();
  const canReview = !isFutureEntry || futureConfirmed;

  async function saveEntry(source: "button-click" | "form-submit") {
    if (saveInFlightRef.current) {
      traceDailyEntry("save ignored because a save is already in flight", { source });
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);
    traceDailyEntry("save handler started", { source, step });
    try {
      idempotencyKeyRef.current ??= createIdempotencyKey();
      let receiptId = uploadedReceiptId;
      if (receiptFile && !receiptId) {
        const receipt = await uploadReceiptFile<{ id: string }>(receiptFile);
        receiptId = receipt.id;
        setUploadedReceiptId(receipt.id);
      }

      const entry = await apiFetch<WealthEntry>("entries", {
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
          idempotency_key: idempotencyKeyRef.current
        })
      });
      traceDailyEntry("entries POST completed", { source, entryId: entry.id });
      setSavedEntry(entry);
      setStep("success");
      router.replace(`/entries/${entry.id}`);
    } catch (saveError) {
      const message = errorMessage(saveError);
      setError(message);
      if (message.toLowerCase().includes("already exists")) {
        setDuplicateConfirmed(true);
      }
      setStep("review");
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    traceDailyEntry("form submit event received", { step });
    void saveEntry("form-submit");
  }

  function handleSaveClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    traceDailyEntry("save button click received", {
      disabled: event.currentTarget.disabled,
      formAttached: event.currentTarget.form !== null,
      step
    });
    void saveEntry("button-click");
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Daily workflow"
            title="Daily Entry"
            subtitle="Record realised profit, review the allocation, and save the entry."
            icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
          />
          <Stepper step={step} />
          <FormMessage tone="error">{error}</FormMessage>
          {duplicateConfirmed ? (
            <FormMessage tone="success">Duplicate date acknowledged. Review and save again to continue.</FormMessage>
          ) : null}

          {step === "success" && savedEntry ? (
            <SuccessState entry={savedEntry} />
          ) : (
            <form
              className="grid gap-5 xl:grid-cols-[1fr_0.82fr]"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="space-y-5">
                {step === "details" ? (
                  <Panel title="Entry Details" icon={<FileText className="h-5 w-5" aria-hidden="true" />}>
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
                    </div>
                    {isFutureEntry ? (
                      <label className="mt-5 flex items-center gap-3 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={futureConfirmed}
                          onChange={(event) => setFutureConfirmed(event.target.checked)}
                          className="h-4 w-4 accent-moss"
                        />
                        Confirm future-dated entry
                      </label>
                    ) : null}
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        disabled={!canReview}
                        onClick={() => setStep("allocation")}
                        className={buttonPrimaryClass}
                      >
                        Continue
                      </button>
                    </div>
                  </Panel>
                ) : null}

                {step === "allocation" ? (
                  <Panel title="Actual Allocation" icon={<Save className="h-5 w-5" aria-hidden="true" />}>
                    <div className="grid gap-4 md:grid-cols-3">
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
                    </div>
                    <label className="mt-5 flex items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={transferConfirmed}
                        onChange={(event) => setTransferConfirmed(event.target.checked)}
                        className="h-4 w-4 accent-moss"
                      />
                      Transfer confirmed
                    </label>
                    <div className="mt-5 flex flex-wrap justify-between gap-2">
                      <button type="button" onClick={() => setStep("details")} className={buttonSecondaryClass}>
                        Back
                      </button>
                      <button type="button" onClick={() => setStep("review")} className={buttonPrimaryClass}>
                        Review
                      </button>
                    </div>
                  </Panel>
                ) : null}

                {step === "review" ? (
                  <Panel title="Review And Save" icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <ReviewRow label="Date" value={entryDate} />
                      <ReviewRow label="Source" value={incomeSource} />
                      <ReviewRow label="Realised profit" value={formatMoney(realisedProfit, currency)} />
                      <ReviewRow label="Actual total" value={formatMoney(actualTotal, currency)} />
                      <ReviewRow label="Receipt" value={receiptFile?.name ?? (uploadedReceiptId ? "Uploaded" : "None")} />
                      <ReviewRow label="Transfer" value={transferConfirmed ? "Confirmed" : "Not confirmed"} />
                    </div>
                    <Field id="notes" label="Notes">
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className={`${inputClass} min-h-24`}
                      />
                    </Field>
                    <div className="mt-5 flex flex-wrap justify-between gap-2">
                      <button type="button" onClick={() => setStep("allocation")} className={buttonSecondaryClass}>
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveClick}
                        className={buttonPrimaryClass}
                      >
                        {saving ? "Saving" : "Save entry"}
                      </button>
                    </div>
                  </Panel>
                ) : null}
              </div>

              <aside className="space-y-5">
                <Panel title="Allocation Preview" icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}>
                  <div className="grid gap-3">
                    <PreviewRow
                      label={`Savings ${settings?.savings_percentage ?? 50}%`}
                      recommended={formatMoney(preview.savings, currency)}
                      actual={formatMoney(actualSavings, currency)}
                    />
                    <PreviewRow
                      label={`Business ${settings?.business_percentage ?? 30}%`}
                      recommended={formatMoney(preview.business, currency)}
                      actual={formatMoney(actualBusiness, currency)}
                    />
                    <PreviewRow
                      label={`Living ${settings?.living_percentage ?? 20}%`}
                      recommended={formatMoney(preview.living, currency)}
                      actual={formatMoney(actualLiving, currency)}
                    />
                  </div>
                </Panel>
                <Panel title="Receipt" icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}>
                  <FileUploader
                    id="entry-receipt"
                    label="Receipt or screenshot"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    file={receiptFile}
                    onFileChange={(file) => {
                      setReceiptFile(file);
                      setUploadedReceiptId(null);
                    }}
                    helper="PNG, JPEG, WebP or PDF"
                    disabled={saving}
                  />
                  <div className="mt-4">
                    <StatusBadge status={uploadedReceiptId ? "uploaded" : receiptFile ? "selected" : "not_attached"} />
                  </div>
                </Panel>
              </aside>
            </form>
          )}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: "details", label: "Details" },
    { id: "allocation", label: "Allocation" },
    { id: "review", label: "Review" },
    { id: "success", label: "Saved" }
  ];
  const currentIndex = steps.findIndex((item) => item.id === step);

  return (
    <div className="grid gap-2 rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-2 sm:grid-cols-4">
      {steps.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-semibold",
            index <= currentIndex ? "bg-moss text-white dark:bg-mist dark:text-ink" : "text-[color:var(--owi-muted)]"
          )}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

function PreviewRow({ label, recommended, actual }: { label: string; recommended: string; actual: string }) {
  return (
    <div className="rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{label}</span>
        <span>{recommended}</span>
      </div>
      <p className="mt-1 text-[color:var(--owi-muted)]">Actual {actual}</p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm">
      <p className="text-[color:var(--owi-muted)]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function SuccessState({ entry }: { entry: WealthEntry }) {
  return (
    <Panel title="Entry Saved" icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Actual Savings" value={formatMoney(entry.actual_savings, entry.currency)} />
        <MetricCard label="Business" value={formatMoney(entry.actual_business, entry.currency)} />
        <MetricCard label="Living" value={formatMoney(entry.actual_living, entry.currency)} />
        <MetricCard label="Status" value={entry.status.replaceAll("_", " ")} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/entries/${entry.id}`} className={buttonPrimaryClass}>
          Open entry
        </Link>
        <Link href="/dashboard" className={buttonSecondaryClass}>
          Dashboard
        </Link>
        <Link href="/entries/new" className={buttonSecondaryClass}>
          New entry
        </Link>
      </div>
    </Panel>
  );
}
