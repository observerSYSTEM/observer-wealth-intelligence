"use client";

import { Check, RotateCw, ScanText, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  MetricCard,
  OCRReviewPanel,
  PageHeader,
  StatusBadge
} from "@/components/wealth-ui";
import { apiFetch, contextualErrorMessage, errorMessage } from "@/lib/api";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { OCRResult } from "@/types/finance";

export default function OCRResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [result, setResult] = useState<OCRResult | null>(null);
  const [form, setForm] = useState({
    amount: "",
    currency: "GBP",
    document_date: "",
    document_time: "",
    reference: "",
    recipient: "",
    sender: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadResult() {
    const data = await apiFetch<OCRResult>(`/api/v1/ocr/results/${params.id}`);
    setResult(data);
    setForm({
      amount: data.amount ?? "",
      currency: data.currency ?? "GBP",
      document_date: data.document_date ?? "",
      document_time: data.document_time ?? "",
      reference: data.reference ?? "",
      recipient: data.recipient ?? "",
      sender: data.sender ?? ""
    });
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<OCRResult>(`/api/v1/ocr/results/${params.id}`);
        if (active) {
          setResult(data);
          setForm({
            amount: data.amount ?? "",
            currency: data.currency ?? "GBP",
            document_date: data.document_date ?? "",
            document_time: data.document_time ?? "",
            reference: data.reference ?? "",
            recipient: data.recipient ?? "",
            sender: data.sender ?? ""
          });
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

  async function confirmResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch<OCRResult>(`/api/v1/ocr/results/${result.id}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({
          amount: form.amount || null,
          currency: form.currency || null,
          document_date: form.document_date || null,
          document_time: form.document_time || null,
          reference: form.reference || null,
          recipient: form.recipient || null,
          sender: form.sender || null,
          status: "confirmed"
        })
      });
      setResult(updated);
      setMessage("OCR result confirmed.");
    } catch (confirmError) {
      setError(contextualErrorMessage(confirmError, "ocr"));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(path: string, success: string) {
    if (!result) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<OCRResult>(`/api/v1/ocr/results/${result.id}/${path}`, {
        method: "POST"
      });
      setMessage(success);
      if (path === "cancel") {
        router.replace("/ocr");
      } else {
        await loadResult();
      }
    } catch (actionError) {
      setError(contextualErrorMessage(actionError, "ocr"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="OCR detail"
            title="OCR Result"
            subtitle="Review extracted fields before confirmation."
            icon={<ScanText className="h-5 w-5" aria-hidden="true" />}
          />
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          {result ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Status" value={statusLabel(result.status)} icon={<ScanText className="h-5 w-5" />} />
                <MetricCard label="Confidence" value={formatPercent(result.confidence_score)} icon={<ScanText className="h-5 w-5" />} />
                <MetricCard
                  label="Amount"
                  value={result.amount && result.currency ? formatMoney(result.amount, result.currency) : "None"}
                  icon={<ScanText className="h-5 w-5" />}
                />
                <MetricCard label="Retries" value={`${result.retry_count}/${result.max_retries}`} icon={<RotateCw className="h-5 w-5" />} />
              </section>
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <OCRReviewPanel result={result}>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={result.source_type} tone="info" />
                    {result.document_date ? <StatusBadge status={result.document_date} tone="neutral" /> : null}
                    {result.reference ? <StatusBadge status="reference_found" tone="success" /> : null}
                  </div>
                </OCRReviewPanel>

                <form
                  onSubmit={(event) => void confirmResult(event)}
                  className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-5 shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id="ocr-detail-amount" label="Amount">
                        <input
                          id="ocr-detail-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.amount}
                          onChange={(event) => setForm({ ...form, amount: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field id="ocr-detail-currency" label="Currency">
                        <select
                          id="ocr-detail-currency"
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
                      <Field id="ocr-detail-date" label="Date">
                        <input
                          id="ocr-detail-date"
                          type="date"
                          value={form.document_date}
                          onChange={(event) => setForm({ ...form, document_date: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field id="ocr-detail-time" label="Time">
                        <input
                          id="ocr-detail-time"
                          type="time"
                          value={form.document_time}
                          onChange={(event) => setForm({ ...form, document_time: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <Field id="ocr-detail-reference" label="Reference">
                      <input
                        id="ocr-detail-reference"
                        value={form.reference}
                        onChange={(event) => setForm({ ...form, reference: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field id="ocr-detail-recipient" label="Recipient">
                        <input
                          id="ocr-detail-recipient"
                          value={form.recipient}
                          onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field id="ocr-detail-sender" label="Sender">
                        <input
                          id="ocr-detail-sender"
                          value={form.sender}
                          onChange={(event) => setForm({ ...form, sender: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={busy} className={buttonPrimaryClass}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Confirm
                      </button>
                      <button type="button" disabled={busy} onClick={() => void runAction("retry", "OCR result queued for retry.")} className={buttonSecondaryClass}>
                        <RotateCw className="h-4 w-4" aria-hidden="true" />
                        Retry
                      </button>
                      <button type="button" disabled={busy} onClick={() => void runAction("cancel", "OCR result cancelled.")} className={buttonSecondaryClass}>
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </>
          ) : null}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
