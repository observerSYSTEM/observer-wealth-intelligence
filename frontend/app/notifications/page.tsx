"use client";

import { Bell, CheckCheck, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { Field, FormMessage, inputClass } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
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
    const data = await apiFetch<NotificationList>("/api/v1/notifications?limit=100");
    setNotifications(data.items);
    setUnreadCount(data.unread_count);
    setPreferences(await apiFetch<NotificationPreference>("/api/v1/notification-preferences"));
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [data, preferenceData] = await Promise.all([
          apiFetch<NotificationList>("/api/v1/notifications?limit=100"),
          apiFetch<NotificationPreference>("/api/v1/notification-preferences")
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
      await apiFetch<Notification>(`/api/v1/notifications/${notificationId}/read`, {
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
      const response = await apiFetch<{ message: string }>("/api/v1/notifications/read-all", {
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
      const updated = await apiFetch<NotificationPreference>("/api/v1/notification-preferences", {
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
      await apiFetch<Notification>("/api/v1/notifications/test-telegram", { method: "POST" });
      setMessage("Telegram test queued.");
      await loadNotifications();
    } catch (telegramError) {
      setError(errorMessage(telegramError));
    }
  }

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" aria-hidden="true" />
                <h2 className="text-xl font-semibold">Notifications</h2>
              </div>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {unreadCount} requiring read
              </p>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-2 rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold dark:border-white/10"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Read all
            </button>
          </div>
          <FormMessage tone="success">{message}</FormMessage>
          <FormMessage tone="error">{error}</FormMessage>
          {preferences ? (
            <form
              onSubmit={(event) => void savePreferences(event)}
              className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 lg:grid-cols-[1fr_1fr_auto]"
            >
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.telegram_enabled}
                  onChange={(event) =>
                    setPreferences({ ...preferences, telegram_enabled: event.target.checked })
                  }
                  className="h-4 w-4 accent-moss"
                />
                Telegram
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.daily_reminder_enabled}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      daily_reminder_enabled: event.target.checked
                    })
                  }
                  className="h-4 w-4 accent-moss"
                />
                Daily reminders
              </label>
              <Field id="daily-reminder-time" label="Reminder time">
                <input
                  id="daily-reminder-time"
                  type="time"
                  value={preferences.daily_reminder_time}
                  onChange={(event) =>
                    setPreferences({ ...preferences, daily_reminder_time: event.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.goal_alerts_enabled}
                  onChange={(event) =>
                    setPreferences({ ...preferences, goal_alerts_enabled: event.target.checked })
                  }
                  className="h-4 w-4 accent-moss"
                />
                Goal alerts
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.ocr_alerts_enabled}
                  onChange={(event) =>
                    setPreferences({ ...preferences, ocr_alerts_enabled: event.target.checked })
                  }
                  className="h-4 w-4 accent-moss"
                />
                OCR alerts
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.backup_alerts_enabled}
                  onChange={(event) =>
                    setPreferences({ ...preferences, backup_alerts_enabled: event.target.checked })
                  }
                  className="h-4 w-4 accent-moss"
                />
                Backup alerts
              </label>
              <div className="flex flex-wrap gap-2 lg:col-span-3">
                <button
                  type="submit"
                  className="rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => void testTelegram()}
                  className="inline-flex items-center gap-2 rounded-md border border-black/10 px-4 py-2.5 text-sm font-semibold dark:border-white/10"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Test Telegram
                </button>
              </div>
            </form>
          ) : null}
          <div className="space-y-3">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{notification.title}</h3>
                    <p className="mt-2 text-sm text-black/70 dark:text-white/70">
                      {notification.message}
                    </p>
                  </div>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                    {statusLabel(notification.status)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-black/60 dark:text-white/60">
                  <span>
                    {statusLabel(notification.type)} / {statusLabel(notification.channel)}
                  </span>
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
                    className="mt-4 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10"
                  >
                    Mark read
                  </button>
                ) : null}
              </article>
            ))}
            {!notifications.length ? (
              <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                No notifications yet.
              </div>
            ) : null}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
