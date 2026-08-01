"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { FormMessage } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMoney, statusLabel } from "@/lib/format";
import type { TimelineEvent, TimelineList } from "@/types/finance";

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadTimeline() {
      try {
        const data = await apiFetch<TimelineList>("/api/v1/timeline?limit=100");
        if (active) {
          setEvents(data.items);
          setTotal(data.total);
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void loadTimeline();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-4 py-6">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-semibold">Timeline</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {total} events
              </p>
            </div>
          </div>
          <FormMessage tone="error">{error}</FormMessage>
          <div className="space-y-3">
            {events.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{item.title}</h3>
                    {item.summary ? (
                      <p className="mt-2 text-sm text-black/70 dark:text-white/70">
                        {item.summary}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-ink dark:bg-white/10 dark:text-white">
                    {statusLabel(item.event_type)}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-black/60 dark:text-white/60">
                  <span>{new Date(item.occurred_at).toLocaleString("en-GB")}</span>
                  {item.amount && item.currency ? (
                    <span className="font-semibold text-ink dark:text-white">
                      {formatMoney(item.amount, item.currency)}
                    </span>
                  ) : null}
                </div>
                {item.entity_type ? (
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-black/50 dark:text-white/50">
                    {statusLabel(item.entity_type)}
                  </p>
                ) : null}
              </article>
            ))}
            {!events.length ? (
              <div className="rounded-lg border border-dashed border-black/15 p-5 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
                No timeline events yet.
              </div>
            ) : null}
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
