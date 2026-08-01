"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { PasswordInput } from "@/components/password-input";
import { RouteLoading } from "@/components/protected-route";
import { ThemeToggle } from "@/components/theme-toggle";
import { errorMessage } from "@/lib/api";

export default function SetupPage() {
  const router = useRouter();
  const { registerOwner, setupStatus, status } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("Europe/London");
  const [preferredCurrency, setPreferredCurrency] = useState("GBP");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <RouteLoading label="Checking setup" />;
  }

  if (status === "authenticated") {
    router.replace("/");
    return <RouteLoading label="Opening dashboard" />;
  }

  if (setupStatus?.owner_exists) {
    router.replace("/login");
    return <RouteLoading label="Opening login" />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (password !== confirmPassword) {
      setMessage("Passwords must match.");
      return;
    }
    setSubmitting(true);
    try {
      await registerOwner({
        display_name: displayName,
        email,
        timezone,
        preferred_currency: preferredCurrency,
        password
      });
      router.replace("/");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-6 text-ink dark:bg-ink dark:text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-xl flex-col">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-moss dark:text-mist">
              Observer
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Owner Setup</h1>
          </div>
          <ThemeToggle />
        </header>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <FormMessage tone="error">{message}</FormMessage>
          <Field id="display-name" label="Display name">
            <input
              id="display-name"
              name="display_name"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="email" label="Email address">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="timezone" label="Timezone">
            <input
              id="timezone"
              name="timezone"
              required
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="preferred-currency" label="Preferred reporting currency">
            <select
              id="preferred-currency"
              name="preferred_currency"
              value={preferredCurrency}
              onChange={(event) => setPreferredCurrency(event.target.value)}
              className={inputClass}
            >
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
              <option value="NGN">NGN</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            value={password}
            autoComplete="new-password"
            onChange={setPassword}
          />
          <PasswordInput
            id="confirm-password"
            name="confirm_password"
            label="Confirm password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={setConfirmPassword}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating account" : "Create owner account"}
          </button>
        </form>
      </div>
    </main>
  );
}
