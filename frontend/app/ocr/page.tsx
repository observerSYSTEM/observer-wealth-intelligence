"use client";

import { Check, ExternalLink, RotateCw, ScanText, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { OCRResult, OCRResultList } from "@/types/finance";

type ReviewState = {
  amount: string;
  currency: string;
  document_date: string;
  document_time: string;
  reference: string;
  recipient: string;
  sender: string;
};

export default function OCRReviewPage() {
  const [results, setResults] = useState<OCRResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadResults() {
    const data = await apiFetch<OCRResultList>("/api/v1/ocr/results?status=review_required&limit=100");
    setResults(data.items);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<OCRResultList>(
          "/api/v1/ocr/results?status=review_required&limit=100"
        );
        if (active) setResults(data.items);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSaved(messageText: string) {
    setMessage(messageText);
    await loadResults();
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <div className="flex items-center gap-2">
            <ScanText className="h-5 w-5" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-semibold">OCR Review</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {results.length} pending
              </p>
            </div>
          </div>
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          <div className="grid gap-4 lg:grid-cols-2">
            {results.map((result) => (
              <ReviewCard
                key={result.id}
                result={result}
                onError={setError}
                onSaved={(messageText) => void handleSaved(messageText)}
              />
            ))}
            {!results.length ? (
              <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                No OCR results need review.
              </div>
            ) : null}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function ReviewCard({
  result,
  onError,
  onSaved
}: {
  result: OCRResult;
  onError: (message: string | null) => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ReviewState>({
    amount: result.amount ?? "",
    currency: result.currency ?? "GBP",
    document_date: result.document_date ?? "",
    document_time: result.document_time ?? "",
    reference: result.reference ?? "",
    recipient: result.recipient ?? "",
    sender: result.sender ?? ""
  });
  const [saving, setSaving] = useState(false);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError(null);
    try {
      await apiFetch<OCRResult>(`/api/v1/ocr/results/${result.id}/confirm`, {
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
      onSaved("OCR result confirmed.");
    } catch (saveError) {
      onError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function cancelResult() {
    setSaving(true);
    onError(null);
    try {
      await apiFetch<OCRResult>(`/api/v1/ocr/results/${result.id}/cancel`, {
        method: "POST"
      });
      onSaved("OCR result cancelled.");
    } catch (cancelError) {
      onError(errorMessage(cancelError));
    } finally {
      setSaving(false);
    }
  }

  async function retryResult() {
    setSaving(true);
    onError(null);
    try {
      await apiFetch<OCRResult>(`/api/v1/ocr/results/${result.id}/retry`, {
        method: "POST"
      });
      onSaved("OCR result queued for retry.");
    } catch (retryError) {
      onError(errorMessage(retryError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{statusLabel(result.source_type)}</h3>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Confidence {formatPercent(result.confidence_score)}
          </p>
        </div>
        <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
          {statusLabel(result.status)}
        </span>
      </div>
      <Link
        href={`/ocr/${result.id}`}
        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-moss dark:text-mist"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        Open review
      </Link>
      {result.amount && result.currency ? (
        <p className="mt-4 text-2xl font-semibold">{formatMoney(result.amount, result.currency)}</p>
      ) : null}
      <pre className="mt-4 max-h-52 overflow-auto rounded-md bg-mist p-3 text-xs dark:bg-white/10">
        {result.extracted_text || "No text extracted."}
      </pre>
      <form onSubmit={(event) => void submitReview(event)} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${result.id}-amount`} label="Amount">
            <input
              id={`${result.id}-amount`}
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field id={`${result.id}-currency`} label="Currency">
            <select
              id={`${result.id}-currency`}
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
          <Field id={`${result.id}-date`} label="Date">
            <input
              id={`${result.id}-date`}
              type="date"
              value={form.document_date}
              onChange={(event) => setForm({ ...form, document_date: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field id={`${result.id}-time`} label="Time">
            <input
              id={`${result.id}-time`}
              type="time"
              value={form.document_time}
              onChange={(event) => setForm({ ...form, document_time: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field id={`${result.id}-reference`} label="Reference">
          <input
            id={`${result.id}-reference`}
            value={form.reference}
            onChange={(event) => setForm({ ...form, reference: event.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${result.id}-recipient`} label="Recipient">
            <input
              id={`${result.id}-recipient`}
              value={form.recipient}
              onChange={(event) => setForm({ ...form, recipient: event.target.value })}
              className={inputClass}
            />
          </Field>
          <Field id={`${result.id}-sender`} label="Sender">
            <input
              id={`${result.id}-sender`}
              value={form.sender}
              onChange={(event) => setForm({ ...form, sender: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Confirm
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void retryResult()}
            className="inline-flex items-center gap-2 rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void cancelResult()}
            className="inline-flex items-center gap-2 rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}
