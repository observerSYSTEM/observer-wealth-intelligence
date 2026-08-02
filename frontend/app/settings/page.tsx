"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute, RouteLoading } from "@/components/protected-route";
import { useTheme } from "@/components/theme-provider";
import { apiFetch, errorMessage } from "@/lib/api";
import type { AppSettings, Currency, ThemePreference } from "@/types/auth";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ProtectedRoute ownerOnly>
      <AppFrame>
        {settings ? (
          <SettingsForm initialSettings={settings} />
        ) : (
          <section className="py-6">
            <FormMessage tone="error">{error}</FormMessage>
            {!error ? <RouteLoading label="Loading settings" /> : null}
          </section>
        )}
      </AppFrame>
    </ProtectedRoute>
  );
}

function SettingsForm({ initialSettings }: { initialSettings: AppSettings }) {
  const { setThemePreference } = useTheme();
  const [registrationEnabled, setRegistrationEnabled] = useState(
    initialSettings.registration_enabled
  );
  const [defaultTimezone, setDefaultTimezone] = useState(initialSettings.default_timezone);
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>(
    initialSettings.default_currency
  );
  const [savingsPercentage, setSavingsPercentage] = useState(initialSettings.savings_percentage);
  const [businessPercentage, setBusinessPercentage] = useState(
    initialSettings.business_percentage
  );
  const [livingPercentage, setLivingPercentage] = useState(initialSettings.living_percentage);
  const [primaryGoalAmount, setPrimaryGoalAmount] = useState(
    String(initialSettings.primary_goal_amount)
  );
  const [primaryGoalCurrency, setPrimaryGoalCurrency] = useState<Currency>(
    initialSettings.primary_goal_currency
  );
  const [receiptOcrEnabled, setReceiptOcrEnabled] = useState(
    initialSettings.receipt_ocr_enabled
  );
  const [themePreference, setThemePreferenceValue] = useState<ThemePreference>(
    initialSettings.theme_preference
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (savingsPercentage + businessPercentage + livingPercentage !== 100) {
      setError("Savings, business, and living percentages must total exactly 100.");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiFetch<AppSettings>("settings", {
        method: "PATCH",
        body: JSON.stringify({
          registration_enabled: registrationEnabled,
          default_timezone: defaultTimezone,
          default_currency: defaultCurrency,
          savings_percentage: savingsPercentage,
          business_percentage: businessPercentage,
          living_percentage: livingPercentage,
          primary_goal_amount: primaryGoalAmount,
          primary_goal_currency: primaryGoalCurrency,
          receipt_ocr_enabled: receiptOcrEnabled,
          theme_preference: themePreference
        })
      });
      setThemePreference(updated.theme_preference);
      setMessage("Settings saved.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={saveSettings}
      className="my-6 space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
    >
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Allocation total: {savingsPercentage + businessPercentage + livingPercentage}%
        </p>
      </div>
      <FormMessage tone="success">{message}</FormMessage>
      <FormMessage tone="error">{error}</FormMessage>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-md border border-black/10 p-3 text-sm font-medium dark:border-white/10">
          <input
            type="checkbox"
            checked={registrationEnabled}
            onChange={(event) => setRegistrationEnabled(event.target.checked)}
            className="h-4 w-4 accent-moss"
          />
          Registration enabled
        </label>
        <label className="flex items-center gap-3 rounded-md border border-black/10 p-3 text-sm font-medium dark:border-white/10">
          <input
            type="checkbox"
            checked={receiptOcrEnabled}
            onChange={(event) => setReceiptOcrEnabled(event.target.checked)}
            className="h-4 w-4 accent-moss"
          />
          Receipt OCR enabled
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="default-timezone" label="Default timezone">
          <input
            id="default-timezone"
            value={defaultTimezone}
            onChange={(event) => setDefaultTimezone(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="default-currency" label="Default currency">
          <CurrencySelect
            id="default-currency"
            value={defaultCurrency}
            onChange={setDefaultCurrency}
          />
        </Field>
        <Field id="savings-percentage" label="Savings percentage">
          <NumberInput
            id="savings-percentage"
            value={savingsPercentage}
            onChange={setSavingsPercentage}
          />
        </Field>
        <Field id="business-percentage" label="Business percentage">
          <NumberInput
            id="business-percentage"
            value={businessPercentage}
            onChange={setBusinessPercentage}
          />
        </Field>
        <Field id="living-percentage" label="Living percentage">
          <NumberInput
            id="living-percentage"
            value={livingPercentage}
            onChange={setLivingPercentage}
          />
        </Field>
        <Field id="primary-goal-amount" label="Primary goal amount">
          <input
            id="primary-goal-amount"
            type="number"
            min="0"
            step="0.01"
            value={primaryGoalAmount}
            onChange={(event) => setPrimaryGoalAmount(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="primary-goal-currency" label="Primary goal currency">
          <CurrencySelect
            id="primary-goal-currency"
            value={primaryGoalCurrency}
            onChange={setPrimaryGoalCurrency}
          />
        </Field>
        <Field id="theme-preference" label="Theme preference">
          <select
            id="theme-preference"
            value={themePreference}
            onChange={(event) => setThemePreferenceValue(event.target.value as ThemePreference)}
            className={inputClass}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving" : "Save settings"}
      </button>
    </form>
  );
}

function NumberInput({
  id,
  value,
  onChange
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      id={id}
      type="number"
      min="0"
      max="100"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={inputClass}
    />
  );
}

function CurrencySelect({
  id,
  value,
  onChange
}: {
  id: string;
  value: Currency;
  onChange: (value: Currency) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as Currency)}
      className={inputClass}
    >
      <option value="GBP">GBP</option>
      <option value="USD">USD</option>
      <option value="NGN">NGN</option>
      <option value="EUR">EUR</option>
    </select>
  );
}
