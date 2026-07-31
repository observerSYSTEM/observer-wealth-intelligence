"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { AppFrame } from "@/components/app-frame";
import { useAuth } from "@/components/auth-provider";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { PasswordInput } from "@/components/password-input";
import { ProtectedRoute, RouteLoading } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/datetime";
import type { User } from "@/types/auth";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <AppFrame>{user ? <ProfileForms key={user.id} user={user} /> : <RouteLoading label="Loading profile" />}</AppFrame>
    </ProtectedRoute>
  );
}

function ProfileForms({ user }: { user: User }) {
  const router = useRouter();
  const { refreshAuth } = useAuth();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [email, setEmail] = useState(user.email);
  const [timezone, setTimezone] = useState(user.timezone);
  const [preferredCurrency, setPreferredCurrency] = useState(user.preferred_currency);
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    if (email.toLowerCase() !== user.email && !passwordConfirmation) {
      setProfileError("Password confirmation is required to change email.");
      return;
    }
    setSavingProfile(true);
    try {
      await apiFetch<User>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName,
          email,
          timezone,
          preferred_currency: preferredCurrency,
          password_confirmation: passwordConfirmation || undefined
        })
      });
      await refreshAuth();
      setPasswordConfirmation("");
      setProfileMessage("Profile saved.");
    } catch (error) {
      setProfileError(errorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords must match.");
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("/api/v1/users/me/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      await refreshAuth();
      router.replace("/login");
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="grid gap-4 py-6 lg:grid-cols-[1fr_0.8fr]">
      <form
        onSubmit={saveProfile}
        className="space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
      >
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {formatDateTime(user.created_at, timezone)}
          </p>
        </div>
        <FormMessage tone="success">{profileMessage}</FormMessage>
        <FormMessage tone="error">{profileError}</FormMessage>
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
            value={preferredCurrency}
            onChange={(event) => setPreferredCurrency(event.target.value as User["preferred_currency"])}
            className={inputClass}
          >
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
            <option value="NGN">NGN</option>
          </select>
        </Field>
        <PasswordInput
          id="password-confirmation"
          name="password_confirmation"
          label="Password confirmation"
          value={passwordConfirmation}
          autoComplete="current-password"
          required={false}
          onChange={setPasswordConfirmation}
        />
        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingProfile ? "Saving" : "Save profile"}
        </button>
      </form>

      <form
        onSubmit={savePassword}
        className="space-y-5 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
      >
        <h2 className="text-lg font-semibold">Password</h2>
        <FormMessage tone="error">{passwordError}</FormMessage>
        <PasswordInput
          id="current-password"
          name="current_password"
          label="Current password"
          value={currentPassword}
          autoComplete="current-password"
          onChange={setCurrentPassword}
        />
        <PasswordInput
          id="new-password"
          name="new_password"
          label="New password"
          value={newPassword}
          autoComplete="new-password"
          onChange={setNewPassword}
        />
        <PasswordInput
          id="confirm-new-password"
          name="confirm_new_password"
          label="Confirm new password"
          value={confirmPassword}
          autoComplete="new-password"
          onChange={setConfirmPassword}
        />
        <button
          type="submit"
          disabled={savingPassword}
          className="rounded-md bg-copper px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-copper/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingPassword ? "Updating" : "Change password"}
        </button>
      </form>
    </section>
  );
}
