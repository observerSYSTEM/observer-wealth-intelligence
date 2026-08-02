"use client";

import { DatabaseBackup, Play, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge
} from "@/components/wealth-ui";
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

  const latestBackup = backups[0];
  const verifiedCount = backups.filter((backup) => backup.restore_verified).length;

  return (
    <ProtectedRoute ownerOnly>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Operations"
            title="Automation Control Centre"
            subtitle="Scheduled Raspberry Pi backups, restore verification, and job status."
            icon={<DatabaseBackup className="h-5 w-5" aria-hidden="true" />}
            actions={
              <button type="button" disabled={busy} onClick={() => void runBackup()} className={buttonPrimaryClass}>
                <Play className="h-4 w-4" aria-hidden="true" />
                Run backup
              </button>
            }
          />
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Jobs" value={String(jobs.length)} icon={<DatabaseBackup className="h-5 w-5" />} />
            <MetricCard label="Backups" value={String(backups.length)} icon={<DatabaseBackup className="h-5 w-5" />} />
            <MetricCard label="Verified" value={String(verifiedCount)} icon={<ShieldCheck className="h-5 w-5" />} tone="positive" />
            <MetricCard label="Latest" value={latestBackup ? statusLabel(latestBackup.status) : "None"} icon={<DatabaseBackup className="h-5 w-5" />} />
          </section>

          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-5">
              <Panel title="Backup Schedule" icon={<DatabaseBackup className="h-5 w-5" aria-hidden="true" />}>
                <form onSubmit={(event) => void saveSchedule(event)} className="space-y-4">
                  <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] px-3 py-2 text-sm font-semibold">
                    <span>Scheduled backups</span>
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={(event) => setSchedule({ ...schedule, enabled: event.target.checked })}
                      className="h-4 w-4 accent-moss"
                    />
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
                        onChange={(event) => setSchedule({ ...schedule, run_time: event.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={busy} className={buttonPrimaryClass}>
                      Save
                    </button>
                    <button type="button" disabled={busy} onClick={() => void runBackup()} className={buttonSecondaryClass}>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Run
                    </button>
                  </div>
                </form>
              </Panel>

              <Panel title="Jobs" icon={<DatabaseBackup className="h-5 w-5" aria-hidden="true" />}>
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div key={job.id} className="rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{job.name}</span>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="mt-1 text-[color:var(--owi-muted)]">
                        {job.enabled ? `${job.cadence} at ${job.run_at_time}` : "disabled"}
                      </p>
                      {job.next_run_at ? (
                        <p className="mt-1 text-[color:var(--owi-muted)]">
                          Next {new Date(job.next_run_at).toLocaleString("en-GB")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {!jobs.length ? <EmptyState title="No automation jobs" /> : null}
                </div>
              </Panel>
            </div>

            <Panel title="Backup History" icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}>
              <div className="space-y-3">
                {backups.map((backup) => (
                  <article
                    key={backup.id}
                    className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words font-semibold">{backup.backup_filename ?? backup.id}</h2>
                        <p className="mt-1 text-sm text-[color:var(--owi-muted)]">
                          {new Date(backup.started_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                      <StatusBadge status={backup.status} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Metric label="Size" value={formatFileSize(backup.size_bytes)} />
                      <Metric label="Verified" value={backup.restore_verified ? "Yes" : "No"} />
                      <Metric label="Trigger" value={statusLabel(backup.trigger)} />
                    </div>
                    {backup.sha256 ? (
                      <p className="mt-4 break-all rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-3 text-xs">
                        {backup.sha256}
                      </p>
                    ) : null}
                    {backup.verification_message ? (
                      <p className="mt-3 text-sm leading-6 text-[color:var(--owi-muted)]">
                        {backup.verification_message}
                      </p>
                    ) : null}
                    {backup.error_message ? (
                      <p className="mt-3 rounded-md border border-copper/30 bg-copper/10 p-3 text-sm text-copper dark:text-[#ffb088]">
                        {backup.error_message}
                      </p>
                    ) : null}
                    <button type="button" onClick={() => void verifyBackup(backup.id)} className={`${buttonSecondaryClass} mt-4`}>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Verify
                    </button>
                  </article>
                ))}
                {!backups.length ? <EmptyState title="No backups yet" /> : null}
              </div>
            </Panel>
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-3 text-sm">
      <p className="text-[color:var(--owi-muted)]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
