"use client";

import { Activity, Database, Server } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { useAuth } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { apiBaseUrl, apiFetch } from "@/lib/api";

type HealthState = {
  status: "ok";
  database: "ok";
  environment: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export function DashboardShell() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthState | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      setLoadState("loading");
      try {
        const data = await apiFetch<HealthState>(
          "/api/v1/health",
          { signal: controller.signal },
          { retryOnUnauthorized: false }
        );
        setHealth(data);
        setLoadState("ready");
      } catch {
        if (!controller.signal.aborted) {
          setHealth(null);
          setLoadState("error");
        }
      }
    }

    void loadHealth();
    return () => controller.abort();
  }, []);

  const statusLabel = useMemo(() => {
    if (loadState === "ready") return "Online";
    if (loadState === "error") return "Unavailable";
    return "Checking";
  }, [loadState]);

  return (
    <ProtectedRoute>
      <AppFrame>
        <section className="grid flex-1 gap-4 py-6 md:grid-cols-3">
          <StatusTile
            icon={<Activity className="h-5 w-5" aria-hidden="true" />}
            label="API"
            value={statusLabel}
            tone={loadState === "ready" ? "good" : loadState === "error" ? "bad" : "neutral"}
          />
          <StatusTile
            icon={<Database className="h-5 w-5" aria-hidden="true" />}
            label="Database"
            value={health?.database === "ok" ? "Connected" : "Pending"}
            tone={health?.database === "ok" ? "good" : "neutral"}
          />
          <StatusTile
            icon={<Server className="h-5 w-5" aria-hidden="true" />}
            label="Environment"
            value={health?.environment ?? "Local"}
            tone="neutral"
          />
        </section>

        <section className="grid gap-4 pb-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Portfolio Overview</h2>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  No financial records have been added.
                </p>
              </div>
              <span className="rounded-md bg-mist px-3 py-1 text-sm font-medium text-ink dark:bg-white/10 dark:text-white">
                GBP
              </span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Tracked value" />
              <Metric label="Savings total" />
              <Metric label="Assets total" />
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
            <h2 className="text-lg font-semibold">System Status</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Signed in" value={user?.display_name ?? "Authenticated"} />
              <Row label="API endpoint" value={apiBaseUrl || "Same origin"} />
              <Row label="Auth mode" value="JWT bearer" />
              <Row label="Storage" value="PostgreSQL" />
            </div>
          </div>
        </section>
      </AppFrame>
    </ProtectedRoute>
  );
}

function StatusTile({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "bg-moss text-white"
      : tone === "bad"
        ? "bg-copper text-white"
        : "bg-mist text-ink dark:bg-white/10 dark:text-white";

  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-md ${toneClass}`}>{icon}</span>
        <span className="text-right text-sm font-medium text-black/55 dark:text-white/60">
          {label}
        </span>
      </div>
      <p className="mt-5 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Metric({ label }: { label: string }) {
  return (
    <div className="min-h-28 rounded-lg border border-dashed border-black/15 p-4 dark:border-white/15">
      <p className="text-sm font-medium text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-4 text-2xl font-semibold">0.00</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-3 last:border-b-0 dark:border-white/10">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
