"use client";

import { Check, ExternalLink, RotateCw, ScanText, XCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  EmptyState,
  MetricCard,
  OCRReviewPanel,
  PageHeader
} from "@/components/wealth-ui";
import { apiFetch, errorMessage } from "@/lib/api";
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
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="OCR"
            title="OCR Reviews"
            subtitle="Extracted fields remain separate until confirmed."
            icon={<ScanText className="h-5 w-5" aria-hidden="true" />}
          />
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Pending Reviews" value={String(results.length)} icon={<ScanText className="h-5 w-5" />} tone={results.length ? "warning" : "neutral"} />
            <MetricCard label="Supported" value="PNG PDF JPG WEBP" icon={<ScanText className="h-5 w-5" />} />
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            {results.map((result) => (
              <ReviewCard
                key={result.id}
                result={result}
                onError={setError}
                onSaved={(messageText) => void handleSaved(messageText)}
              />
            ))}
            {!results.length ? (
              <EmptyState title="No OCR results need review" message="New OCR jobs will appear here before they can be confirmed." />
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
    <OCRReviewPanel
      result={result}
      actions={
        <Link href={`/ocr/${result.id}`} className={buttonSecondaryClass}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open review
        </Link>
      }
    >
      <form onSubmit={(event) => void submitReview(event)} className="space-y-3">
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
          <button type="submit" disabled={saving} className={buttonPrimaryClass}>
            <Check className="h-4 w-4" aria-hidden="true" />
            Confirm
          </button>
          <button type="button" disabled={saving} onClick={() => void retryResult()} className={buttonSecondaryClass}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
          <button type="button" disabled={saving} onClick={() => void cancelResult()} className={buttonSecondaryClass}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
        </div>
      </form>
    </OCRReviewPanel>
  );
}
