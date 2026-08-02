"use client";

import { Clock3, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { FormMessage } from "@/components/form-shell";
import { ProtectedRoute } from "@/components/protected-route";
import {
  ActivityTimeline,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  SearchInput,
  StatusBadge
} from "@/components/wealth-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import type { TimelineEvent, TimelineList } from "@/types/finance";

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
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

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) =>
      [event.title, event.summary, event.event_type, event.entity_type, event.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [events, query]);

  const latestEvent = events[0];

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="space-y-5 py-5">
          <PageHeader
            eyebrow="Unified history"
            title="Wealth Timeline"
            subtitle="Savings, assets, receipts, goals, OCR, notifications, and backup events."
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
          />
          <FormMessage tone="error">{error}</FormMessage>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Events" value={String(total)} icon={<Clock3 className="h-5 w-5" />} />
            <MetricCard label="Visible" value={String(filteredEvents.length)} icon={<Search className="h-5 w-5" />} />
            <MetricCard
              label="Latest Status"
              value={latestEvent?.status ?? "None"}
              icon={<Clock3 className="h-5 w-5" />}
            />
            <MetricCard
              label="Latest Type"
              value={latestEvent?.event_type.replaceAll("_", " ") ?? "None"}
              icon={<Clock3 className="h-5 w-5" />}
            />
          </section>

          <Panel
            title="Timeline"
            icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}
            actions={<SearchInput id="timeline-search" value={query} onChange={setQuery} placeholder="Filter timeline" />}
          >
            {latestEvent?.status ? <div className="mb-4"><StatusBadge status={latestEvent.status} /></div> : null}
            {filteredEvents.length ? (
              <ActivityTimeline items={filteredEvents} emptyTitle="No timeline events" />
            ) : (
              <EmptyState title="No matching timeline events" />
            )}
          </Panel>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}
