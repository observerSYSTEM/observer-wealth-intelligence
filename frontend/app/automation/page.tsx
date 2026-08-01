"use client";

import { DatabaseBackup, Play, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatFileSize, statusLabel } from "@/lib/format";
import type {
  AutomationJob,
  AutomationJobList,
  BackupRun,
  BackupRunList,
  BackupStatus
} from "@/types/finance";

export default function AutomationPage() {
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [backups, setBackups] = useState<BackupRun[]>([]);
  const [schedule, setSchedule] = useState({ enabled: false, frequency: "daily", run_time: "02:30" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadAutomation() {
    const [jobData, backupData] = await Promise.all([
      apiFetch<AutomationJobList>("/api/v1/automation/jobs"),
      apiFetch<BackupRunList>("/api/v1/backups/history")
    ]);
    setJobs(jobData.items);
    setBackups(backupData.items);
    const status = await apiFetch<BackupStatus>("/api/v1/backups/status");
    if (status.settings) {
      setSchedule({
        enabled: status.settings.enabled,
        frequency: status.settings.frequency,
        run_time: status.settings.run_time
      });
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [jobData, backupData] = await Promise.all([
          apiFetch<AutomationJobList>("/api/v1/automation/jobs"),
          apiFetch<BackupRunList>("/api/v1/backups/history")
        ]);
        if (active) {
          setJobs(jobData.items);
          setBackups(backupData.items);
          const status = await apiFetch<BackupStatus>("/api/v1/backups/status");
          if (active && status.settings) {
            setSchedule({
              enabled: status.settings.enabled,
              frequency: status.settings.frequency,
              run_time: status.settings.run_time
            });
          }
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/v1/backups/settings", {
        method: "PATCH",
        body: JSON.stringify(schedule)
      });
      setMessage("Backup schedule saved.");
      await loadAutomation();
    } catch (scheduleError) {
      setError(errorMessage(scheduleError));
    } finally {
      setBusy(false);
    }
  }

  async function runBackup() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<BackupRun>("/api/v1/backups/run", {
        method: "POST",
        body: JSON.stringify({ trigger: "manual" })
      });
      setMessage("Backup completed and verified.");
      await loadAutomation();
    } catch (backupError) {
      setError(errorMessage(backupError));
    } finally {
      setBusy(false);
    }
  }

  async function verifyBackup(backupId: string) {
    setError(null);
    try {
      await apiFetch<BackupRun>("/api/v1/backups/verify", {
        method: "POST",
        body: JSON.stringify({ backup_id: backupId, latest: false })
      });
      await loadAutomation();
    } catch (verifyError) {
      setError(errorMessage(verifyError));
    }
  }

  return (
    <ProtectedRoute ownerOnly>
      <AppFrame>
        <section className="grid gap-4 py-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-4">
            <form
              onSubmit={(event) => void saveSchedule(event)}
              className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Automation</h2>
              </div>
              <div className="mt-5 space-y-4">
                <FormMessage tone="success">{message}</FormMessage>
                <FormMessage tone="error">{error}</FormMessage>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                      checked={schedule.enabled}
                      onChange={(event) => setSchedule({ ...schedule, enabled: event.target.checked })}
                    className="h-4 w-4 accent-moss"
                  />
                  Scheduled backups
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="backup-cadence" label="Cadence">
                    <select
                      id="backup-cadence"
                      value={schedule.frequency}
                      onChange={(event) => setSchedule({ ...schedule, frequency: event.target.value })}
                      className={inputClass}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </Field>
                  <Field id="backup-time" label="Time">
                    <input
                      id="backup-time"
                      type="time"
                      value={schedule.run_time}
                      onChange={(event) =>
                        setSchedule({ ...schedule, run_time: event.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runBackup()}
                    className="inline-flex items-center gap-2 rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 dark:border-white/10"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Run
                  </button>
                </div>
              </div>
            </form>
            <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h3 className="font-semibold">Jobs</h3>
              <div className="mt-3 space-y-2">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-md bg-mist p-3 text-sm dark:bg-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{job.name}</span>
                      <span>{statusLabel(job.status)}</span>
                    </div>
                    <p className="mt-1 text-black/60 dark:text-white/60">
                      {job.enabled ? `${job.cadence} at ${job.run_at_time}` : "disabled"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {backups.map((backup) => (
              <article
                key={backup.id}
                className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{backup.backup_filename ?? backup.id}</h3>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                      {new Date(backup.started_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                    {statusLabel(backup.status)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="Size" value={formatFileSize(backup.size_bytes)} />
                  <Metric label="Verified" value={backup.restore_verified ? "Yes" : "No"} />
                  <Metric label="Trigger" value={statusLabel(backup.trigger)} />
                </div>
                {backup.sha256 ? (
                  <p className="mt-4 break-all rounded-md bg-mist p-3 text-xs dark:bg-white/10">
                    {backup.sha256}
                  </p>
                ) : null}
                {backup.verification_message ? (
                  <p className="mt-3 text-sm text-black/60 dark:text-white/60">
                    {backup.verification_message}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void verifyBackup(backup.id)}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Verify
                </button>
              </article>
            ))}
            {!backups.length ? (
              <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                No backups yet.
              </div>
            ) : null}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-mist p-3 text-sm dark:bg-white/10">
      <p className="text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
