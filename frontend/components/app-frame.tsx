"use client";

import {
  Bell,
  BriefcaseBusiness,
  ChartPie,
  Clock3,
  DatabaseBackup,
  FileText,
  FolderArchive,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ScanText,
  Settings,
  Target,
  UserRound
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";
import { ConnectionStatus } from "@/components/connection-status";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppFrame({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth();

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-ink transition-colors dark:bg-ink dark:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4 dark:border-white/10">
          <Link href="/" className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-moss dark:text-mist">
              Observer
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Wealth Intelligence</h1>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Account">
            <Link
              href="/dashboard"
              title="Dashboard"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/entries"
              title="Entries"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <FileText className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/portfolio"
              title="Portfolio"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <ChartPie className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/goals"
              title="Goals"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <Target className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/assets"
              title="Assets"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/vault"
              title="Digital vault"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <FolderArchive className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/receipts"
              title="Receipt vault"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/ocr"
              title="OCR review"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <ScanText className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/timeline"
              title="Timeline"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <Clock3 className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/notifications"
              title="Notifications"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/profile"
              title="Profile"
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </Link>
            {user?.role === "owner" ? (
              <>
                <Link
                  href="/automation"
                  title="Automation"
                  className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
                </Link>
                <Link
                  href="/settings"
                  title="Settings"
                  className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <Settings className="h-5 w-5" aria-hidden="true" />
                </Link>
              </>
            ) : null}
            <ConnectionStatus />
            <ThemeToggle />
            <button
              type="button"
              title="Log out"
              aria-label="Log out"
              onClick={() => void logout()}
              className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm transition hover:bg-mist dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
