"use client";

import { Save, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { statusLabel } from "@/lib/format";
import type { Goal } from "@/types/finance";

const categories = [
  "emergency_fund",
  "house",
  "land",
  "relocation",
  "business",
  "education",
  "investment",
  "family",
  "vehicle",
  "retirement",
  "other"
];

const progressSources = ["manual", "tracked_savings", "linked_assets"];

export default function NewGoalPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "other",
    currency: "GBP",
    target_amount: "",
    starting_amount: "0.00",
    deadline: "",
    priority: "3",
    progress_source: "manual",
    is_primary: false,
    notes: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const goal = await apiFetch<Goal>("goals", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          description: form.description || null,
          deadline: form.deadline || null,
          notes: form.notes || null,
          priority: Number(form.priority)
        })
      });
      router.replace(`/goals/${goal.id}`);
    } catch (goalError) {
      setError(errorMessage(goalError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="mx-auto w-full max-w-3xl py-6">
          <form
            onSubmit={(event) => void createGoal(event)}
            className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-lg font-semibold">New Goal</h2>
            </div>
            <div className="mt-5 space-y-4">
              <FormMessage tone="error">{error}</FormMessage>
              <Field id="new-goal-name" label="Name">
                <input
                  id="new-goal-name"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field id="new-goal-description" label="Description">
                <textarea
                  id="new-goal-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="new-goal-category" label="Category">
                  <select
                    id="new-goal-category"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    className={inputClass}
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {statusLabel(item)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="new-goal-currency" label="Currency">
                  <select
                    id="new-goal-currency"
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
                <Field id="new-goal-target" label="Target amount">
                  <input
                    id="new-goal-target"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.target_amount}
                    onChange={(event) => setForm({ ...form, target_amount: event.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field id="new-goal-starting" label="Starting amount">
                  <input
                    id="new-goal-starting"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.starting_amount}
                    onChange={(event) => setForm({ ...form, starting_amount: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="new-goal-deadline" label="Deadline">
                  <input
                    id="new-goal-deadline"
                    type="date"
                    value={form.deadline}
                    onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field id="new-goal-source" label="Progress source">
                  <select
                    id="new-goal-source"
                    value={form.progress_source}
                    onChange={(event) => setForm({ ...form, progress_source: event.target.value })}
                    className={inputClass}
                  >
                    {progressSources.map((item) => (
                      <option key={item} value={item}>
                        {statusLabel(item)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={(event) => setForm({ ...form, is_primary: event.target.checked })}
                  className="h-4 w-4 accent-moss"
                />
                Primary goal
              </label>
              <Field id="new-goal-notes" label="Notes">
                <textarea
                  id="new-goal-notes"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {saving ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
