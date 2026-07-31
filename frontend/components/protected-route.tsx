"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";

export function ProtectedRoute({
  children,
  ownerOnly = false
}: {
  children: ReactNode;
  ownerOnly?: boolean;
}) {
  const router = useRouter();
  const { status, user, setupStatus } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    if (setupStatus?.owner_exists === false || status === "setup-required") {
      router.replace("/setup");
      return;
    }
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (ownerOnly && user?.role !== "owner") {
      router.replace("/profile");
    }
  }, [ownerOnly, router, setupStatus?.owner_exists, status, user?.role]);

  if (status === "loading") {
    return <RouteLoading label="Checking session" />;
  }

  if (status !== "authenticated" || (ownerOnly && user?.role !== "owner")) {
    return <RouteLoading label="Redirecting" />;
  }

  return children;
}

export function RouteLoading({ label }: { label: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f4] text-ink dark:bg-ink dark:text-white">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-moss border-t-transparent dark:border-mist dark:border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-black/65 dark:text-white/65">{label}</p>
      </div>
    </main>
  );
}
