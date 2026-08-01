"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import type { Asset } from "@/types/finance";

const categories = ["cash", "investment", "crypto", "property", "business", "trading_account", "vehicle", "other"];
const currencies = ["GBP", "USD", "NGN", "EUR"];
const statuses = ["active", "sold", "closed", "archived"];

export default function NewAssetPage() {
  const router = useRouter();
  const [category, setCategory] = useState("cash");
  const [assetName, setAssetName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [purchasePrice, setPurchasePrice] = useState("0.00");
  const [currentValue, setCurrentValue] = useState("0.00");
  const [exchangeRate, setExchangeRate] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [institution, setInstitution] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const asset = await apiFetch<Asset>("/api/v1/assets", {
        method: "POST",
        body: JSON.stringify({
          category,
          asset_name: assetName,
          currency,
          purchase_price: purchasePrice,
          current_value: currentValue,
          exchange_rate_to_primary: exchangeRate || null,
          purchase_date: purchaseDate || null,
          institution: institution || null,
          reference: reference || null,
          notes: notes || null,
          status
        })
      });
      router.replace(`/assets/${asset.id}`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <form onSubmit={submit} className="grid gap-4 py-6 lg:grid-cols-[1fr_0.7fr]">
          <section className="space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div>
              <h2 className="text-lg font-semibold">New Asset</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Add a portfolio asset with its first value history record.
              </p>
            </div>
            <FormMessage tone="error">{error}</FormMessage>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="asset-name" label="Asset name">
                <input id="asset-name" value={assetName} onChange={(event) => setAssetName(event.target.value)} className={inputClass} />
              </Field>
              <Field id="asset-category" label="Category">
                <select id="asset-category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
                  {categories.map((item) => (
                    <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </Field>
              <Field id="currency" label="Currency">
                <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputClass}>
                  {currencies.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field id="purchase-price" label="Purchase price">
                <input id="purchase-price" type="number" step="0.01" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} className={inputClass} />
              </Field>
              <Field id="current-value" label="Current value">
                <input id="current-value" type="number" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} className={inputClass} />
              </Field>
              <Field id="exchange-rate" label="Exchange rate placeholder">
                <input id="exchange-rate" type="number" step="0.000001" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} className={inputClass} />
              </Field>
              <Field id="purchase-date" label="Purchase date">
                <input id="purchase-date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className={inputClass} />
              </Field>
              <Field id="status" label="Status">
                <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                  {statuses.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field id="institution" label="Institution">
                <input id="institution" value={institution} onChange={(event) => setInstitution(event.target.value)} className={inputClass} />
              </Field>
              <Field id="reference" label="Reference">
                <input id="reference" value={reference} onChange={(event) => setReference(event.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field id="notes" label="Notes">
              <textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} min-h-28`} />
            </Field>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving" : "Save asset"}
            </button>
          </section>
          <aside className="rounded-lg border border-black/10 bg-white p-5 text-sm text-black/60 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/60">
            Value changes after creation are stored as history records. Currency is kept stable once history exists.
          </aside>
        </form>
      </AppFrame>
    </ProtectedRoute>
  );
}
