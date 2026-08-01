"use client";

import { Check, RotateCw, ScanText, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
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
      setError(errorMessage(confirmError));
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
      setError(errorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="mx-auto w-full max-w-4xl space-y-4 py-6">
          <div className="flex items-center gap-2">
            <ScanText className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-xl font-semibold">OCR Result</h2>
          </div>
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          {result ? (
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <article className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{statusLabel(result.source_type)}</span>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                    {statusLabel(result.status)}
                  </span>
                </div>
                {result.amount && result.currency ? (
                  <p className="mt-4 text-3xl font-semibold">
                    {formatMoney(result.amount, result.currency)}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-black/60 dark:text-white/60">
                  Confidence {formatPercent(result.confidence_score)}
                </p>
                {result.failure_message ? (
                  <p className="mt-3 rounded-md border border-copper/30 bg-copper/10 p-3 text-sm text-copper dark:text-[#ffb088]">
                    {result.failure_message}
                  </p>
                ) : null}
                <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-mist p-3 text-xs dark:bg-white/10">
                  {result.extracted_text || "No text extracted."}
                </pre>
              </article>
              <form
                onSubmit={(event) => void confirmResult(event)}
                className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
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
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction("retry", "OCR result queued for retry.")}
                      className="inline-flex items-center gap-2 rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" />
                      Retry
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction("cancel", "OCR result cancelled.")}
                      className="inline-flex items-center gap-2 rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
