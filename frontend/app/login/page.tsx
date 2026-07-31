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

export default function LoginPage() {
  const router = useRouter();
  const { clearSessionExpired, login, sessionExpired, setupStatus, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <RouteLoading label="Checking session" />;
  }

  if (status === "setup-required" || setupStatus?.owner_exists === false) {
    router.replace("/setup");
    return <RouteLoading label="Opening setup" />;
  }

  if (status === "authenticated") {
    router.replace("/");
    return <RouteLoading label="Opening dashboard" />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    clearSessionExpired();
    setSubmitting(true);
    try {
      await login({ email, password });
      router.replace("/");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-6 text-ink dark:bg-ink dark:text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-moss dark:text-mist">
              Observer
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Login</h1>
          </div>
          <ThemeToggle />
        </header>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <FormMessage tone="error">
            {message ?? (sessionExpired ? "Your session expired. Please log in again." : null)}
          </FormMessage>
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
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            value={password}
            autoComplete="current-password"
            onChange={setPassword}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
