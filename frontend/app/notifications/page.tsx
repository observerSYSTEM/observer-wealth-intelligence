"use client";

import { Bell, CheckCheck, Send } from "lucide-react";
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
import { statusLabel } from "@/lib/format";
import type { Notification, NotificationList, NotificationPreference } from "@/types/finance";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadNotifications() {
    const data = await apiFetch<NotificationList>("notifications?limit=100");
    setNotifications(data.items);
    setUnreadCount(data.unread_count);
    setPreferences(await apiFetch<NotificationPreference>("notification-preferences"));
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [data, preferenceData] = await Promise.all([
          apiFetch<NotificationList>("notifications?limit=100"),
          apiFetch<NotificationPreference>("notification-preferences")
        ]);
        if (active) {
          setNotifications(data.items);
          setPreferences(preferenceData);
          setUnreadCount(data.unread_count);
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

  async function markRead(notificationId: string) {
    setError(null);
    try {
      await apiFetch<Notification>(`notifications/${notificationId}/read`, {
        method: "PATCH"
      });
      await loadNotifications();
    } catch (readError) {
      setError(errorMessage(readError));
    }
  }

  async function markAllRead() {
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<{ message: string }>("notifications/read-all", {
        method: "POST"
      });
      setMessage(response.message);
      await loadNotifications();
    } catch (readError) {
      setError(errorMessage(readError));
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences) return;
    setError(null);
    setMessage(null);
    try {
      const updated = await apiFetch<NotificationPreference>("notification-preferences", {
        method: "PATCH",
        body: JSON.stringify({
          telegram_enabled: preferences.telegram_enabled,
          daily_reminder_enabled: preferences.daily_reminder_enabled,
          daily_reminder_time: preferences.daily_reminder_time,
          weekly_summary_enabled: preferences.weekly_summary_enabled,
          goal_alerts_enabled: preferences.goal_alerts_enabled,
          ocr_alerts_enabled: preferences.ocr_alerts_enabled,
          backup_alerts_enabled: preferences.backup_alerts_enabled,
          quiet_hours_start: preferences.quiet_hours_start,
          quiet_hours_end: preferences.quiet_hours_end,
          timezone: preferences.timezone
        })
      });
      setPreferences(updated);
      setMessage("Notification preferences saved.");
    } catch (preferenceError) {
      setError(errorMessage(preferenceError));
    }
  }

  async function testTelegram() {
    setError(null);
    setMessage(null);
    try {
      await apiFetch<Notification>("notifications/test-telegram", { method: "POST" });
      setMessage("Telegram test queued.");
      await loadNotifications();
    } catch (telegramError) {
      setError(errorMessage(telegramError));
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Signals"
            title="Notifications"
            subtitle="In-app alerts, optional Telegram delivery, reminders, OCR, goals, and backup notices."
            icon={<Bell className="h-5 w-5" aria-hidden="true" />}
            actions={
              <button type="button" onClick={() => void markAllRead()} className={buttonSecondaryClass}>
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                Read all
              </button>
            }
          />
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Unread" value={String(unreadCount)} icon={<Bell className="h-5 w-5" />} tone={unreadCount > 0 ? "warning" : "neutral"} />
            <MetricCard label="Total Loaded" value={String(notifications.length)} icon={<Bell className="h-5 w-5" />} />
            <MetricCard label="Telegram" value={preferences?.telegram_enabled ? "On" : "Off"} icon={<Send className="h-5 w-5" />} />
            <MetricCard label="Daily Reminder" value={preferences?.daily_reminder_enabled ? preferences.daily_reminder_time : "Off"} icon={<Bell className="h-5 w-5" />} />
          </section>

          {preferences ? (
            <Panel title="Preferences" icon={<Bell className="h-5 w-5" aria-hidden="true" />}>
              <form onSubmit={(event) => void savePreferences(event)} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Toggle
                    label="Telegram"
                    checked={preferences.telegram_enabled}
                    onChange={(checked) => setPreferences({ ...preferences, telegram_enabled: checked })}
                  />
                  <Toggle
                    label="Daily reminders"
                    checked={preferences.daily_reminder_enabled}
                    onChange={(checked) => setPreferences({ ...preferences, daily_reminder_enabled: checked })}
                  />
                  <Toggle
                    label="Weekly summary"
                    checked={preferences.weekly_summary_enabled}
                    onChange={(checked) => setPreferences({ ...preferences, weekly_summary_enabled: checked })}
                  />
                  <Toggle
                    label="Goal alerts"
                    checked={preferences.goal_alerts_enabled}
                    onChange={(checked) => setPreferences({ ...preferences, goal_alerts_enabled: checked })}
                  />
                  <Toggle
                    label="OCR alerts"
                    checked={preferences.ocr_alerts_enabled}
                    onChange={(checked) => setPreferences({ ...preferences, ocr_alerts_enabled: checked })}
                  />
                  <Toggle
                    label="Backup alerts"
                    checked={preferences.backup_alerts_enabled}
                    onChange={(checked) => setPreferences({ ...preferences, backup_alerts_enabled: checked })}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field id="daily-reminder-time" label="Reminder time">
                    <input
                      id="daily-reminder-time"
                      type="time"
                      value={preferences.daily_reminder_time}
                      onChange={(event) => setPreferences({ ...preferences, daily_reminder_time: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="quiet-start" label="Quiet start">
                    <input
                      id="quiet-start"
                      type="time"
                      value={preferences.quiet_hours_start ?? ""}
                      onChange={(event) => setPreferences({ ...preferences, quiet_hours_start: event.target.value || null })}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="quiet-end" label="Quiet end">
                    <input
                      id="quiet-end"
                      type="time"
                      value={preferences.quiet_hours_end ?? ""}
                      onChange={(event) => setPreferences({ ...preferences, quiet_hours_end: event.target.value || null })}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={buttonPrimaryClass}>Save</button>
                  <button type="button" onClick={() => void testTelegram()} className={buttonSecondaryClass}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Test Telegram
                  </button>
                </div>
              </form>
            </Panel>
          ) : null}

          <Panel title="Inbox" icon={<Bell className="h-5 w-5" aria-hidden="true" />}>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold">{notification.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--owi-muted)]">{notification.message}</p>
                    </div>
                    <StatusBadge status={notification.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--owi-muted)]">
                    <span>{statusLabel(notification.type)} / {statusLabel(notification.channel)} / {statusLabel(notification.severity)}</span>
                    <span>{new Date(notification.created_at).toLocaleString("en-GB")}</span>
                  </div>
                  {notification.failure_reason ? (
                    <p className="mt-3 rounded-md border border-copper/30 bg-copper/10 p-3 text-sm text-copper dark:text-[#ffb088]">
                      {notification.failure_reason}
                    </p>
                  ) : null}
                  {notification.status !== "read" && notification.channel === "in_app" ? (
                    <button
                      type="button"
                      onClick={() => void markRead(notification.id)}
                      className={`${buttonSecondaryClass} mt-4`}
                    >
                      Mark read
                    </button>
                  ) : null}
                </article>
              ))}
              {!notifications.length ? <EmptyState title="No notifications yet" /> : null}
            </div>
          </Panel>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] px-3 py-2 text-sm font-semibold">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-moss"
      />
    </label>
  );
}
