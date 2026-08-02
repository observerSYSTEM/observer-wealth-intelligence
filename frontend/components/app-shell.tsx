"use client";

import {
  Bell,
  BriefcaseBusiness,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DatabaseBackup,
  FileText,
  FolderArchive,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  ScanText,
  Settings,
  Smartphone,
  Sun,
  Target,
  UserRound,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { useTheme } from "@/components/theme-provider";
import { apiFetch, errorMessage } from "@/lib/api";
import { statusLabel } from "@/lib/format";
import type { DashboardSummary, Notification, NotificationList } from "@/types/finance";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cn,
  StatusBadge,
  surfaceClass
} from "@/components/wealth-ui";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  ownerOnly?: boolean;
  badge?: "ocr" | "notifications";
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0-rc.1";

const navigationItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/entries/new", label: "Daily Entry", icon: <Save className="h-5 w-5" /> },
  { href: "/entries", label: "Entry History", icon: <FileText className="h-5 w-5" /> },
  { href: "/receipts", label: "Receipts", icon: <ReceiptText className="h-5 w-5" /> },
  { href: "/portfolio", label: "Portfolio", icon: <ChartPie className="h-5 w-5" /> },
  { href: "/assets", label: "Assets", icon: <BriefcaseBusiness className="h-5 w-5" /> },
  { href: "/goals", label: "Goals", icon: <Target className="h-5 w-5" /> },
  { href: "/timeline", label: "Timeline", icon: <Clock3 className="h-5 w-5" /> },
  { href: "/vault", label: "Vault", icon: <FolderArchive className="h-5 w-5" /> },
  { href: "/ocr", label: "OCR Reviews", icon: <ScanText className="h-5 w-5" />, badge: "ocr" },
  { href: "/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" />, badge: "notifications" },
  { href: "/automation", label: "Automation", icon: <DatabaseBackup className="h-5 w-5" />, ownerOnly: true },
  { href: "/settings", label: "Settings", icon: <Settings className="h-5 w-5" />, ownerOnly: true }
];

const routeTitles: Array<[string, string]> = [
  ["/entries/new", "Daily Entry"],
  ["/entries", "Entry History"],
  ["/receipts", "Receipts"],
  ["/portfolio", "Portfolio"],
  ["/assets/new", "New Asset"],
  ["/assets", "Assets"],
  ["/goals/new", "New Goal"],
  ["/goals", "Goals"],
  ["/timeline", "Timeline"],
  ["/vault", "Digital Vault"],
  ["/ocr", "OCR Reviews"],
  ["/notifications", "Notifications"],
  ["/automation", "Automation"],
  ["/settings", "Settings"],
  ["/profile", "Profile"],
  ["/dashboard", "Dashboard"],
  ["/", "Dashboard"]
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("owi:sidebar-collapsed") === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    window.localStorage.setItem("owi:sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadShellSummary() {
      try {
        const data = await apiFetch<DashboardSummary>("dashboard/summary");
        if (active) setSummary(data);
      } catch {
        if (active) setSummary(null);
      }
    }
    void loadShellSummary();
    return () => {
      active = false;
    };
  }, []);

  const title = useMemo(() => pageTitle(pathname), [pathname]);
  const filteredNavigation = navigationItems.filter((item) => !item.ownerOnly || user?.role === "owner");
  const counts = {
    ocr: summary?.pending_ocr_reviews ?? 0,
    notifications: summary?.unread_notifications ?? 0
  };

  return (
    <div className="min-h-screen bg-[color:var(--owi-bg)] text-[color:var(--owi-text)] transition-colors">
      <div className="flex min-h-screen">
        <Sidebar
          items={filteredNavigation}
          pathname={pathname}
          collapsed={collapsed}
          counts={counts}
          userName={user?.display_name ?? user?.email ?? "Observer"}
          onToggle={() => setCollapsed((current) => !current)}
          onLogout={() => void logout()}
        />
        <MobileDrawer
          open={mobileOpen}
          items={filteredNavigation}
          pathname={pathname}
          counts={counts}
          userName={user?.display_name ?? user?.email ?? "Observer"}
          onClose={() => setMobileOpen(false)}
          onLogout={() => void logout()}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopCommandBar
            title={title}
            online={online}
            unreadCount={counts.notifications}
            pendingOcrCount={counts.ocr}
            userName={user?.display_name ?? user?.email ?? "Observer"}
            onMenu={() => setMobileOpen(true)}
            onLogout={() => void logout()}
          />
          <div className="px-4 pb-24 pt-3 sm:px-6 lg:px-8 lg:pb-8">
            <div className="mx-auto w-full max-w-[1440px]">
              <OfflineBanner />
              {children}
            </div>
          </div>
        </div>
      </div>
      <BottomNavigation pathname={pathname} onMore={() => setMobileOpen(true)} />
    </div>
  );
}

export function Sidebar({
  items,
  pathname,
  collapsed,
  counts,
  userName,
  onToggle,
  onLogout
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  counts: { ocr: number; notifications: number };
  userName: string;
  onToggle: () => void;
  onLogout: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-[color:var(--owi-border)] bg-[color:var(--owi-sidebar)] px-3 py-4 lg:flex lg:flex-col",
        collapsed ? "w-[5.25rem]" : "w-72"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <Link
          href="/dashboard"
          className={cn("flex min-w-0 items-center gap-3 rounded-md p-2 hover:bg-[color:var(--owi-surface-hover)]", collapsed && "justify-center")}
          title="Observer Wealth Intelligence"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-moss text-sm font-black text-white dark:bg-mist dark:text-ink">
            OWI
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Observer Wealth</span>
              <span className="block text-xs text-[color:var(--owi-muted)]">Intelligence</span>
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[color:var(--owi-border)] hover:bg-[color:var(--owi-surface-hover)]"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Primary">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActivePath(pathname, item.href)}
            collapsed={collapsed}
            count={item.badge ? counts[item.badge] : 0}
          />
        ))}
      </nav>

      <div className="mt-4 space-y-2 border-t border-[color:var(--owi-border)] pt-4">
        <Link
          href="/profile"
          className={cn("flex min-w-0 items-center gap-3 rounded-md p-2 hover:bg-[color:var(--owi-surface-hover)]", collapsed && "justify-center")}
          title="Profile"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--owi-surface-elevated)]">
            <UserRound className="h-4 w-4" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{userName}</span>
              <span className="block text-xs text-[color:var(--owi-muted)]">v{appVersion}</span>
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          title="Log out"
          className={cn(
            "flex min-h-10 w-full items-center gap-3 rounded-md p-2 text-sm font-semibold hover:bg-[color:var(--owi-surface-hover)]",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed ? <span>Log out</span> : <span className="sr-only">Log out</span>}
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  count
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count: number;
}) {
  return (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-moss text-white shadow-sm dark:bg-mist dark:text-ink"
          : "text-[color:var(--owi-muted)] hover:bg-[color:var(--owi-surface-hover)] hover:text-[color:var(--owi-text)]",
        collapsed && "justify-center px-2"
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
      {count > 0 ? (
        <span
          className={cn(
            "grid min-h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold",
            active ? "bg-white/20 text-white dark:bg-ink/15 dark:text-ink" : "bg-copper text-white"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function MobileDrawer({
  open,
  items,
  pathname,
  counts,
  userName,
  onClose,
  onLogout
}: {
  open: boolean;
  items: NavItem[];
  pathname: string;
  counts: { ocr: number; notifications: number };
  userName: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-[min(22rem,86vw)] flex-col bg-[color:var(--owi-sidebar)] p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-moss text-sm font-black text-white dark:bg-mist dark:text-ink">
              OWI
            </span>
            <span>
              <span className="block text-sm font-semibold">Observer Wealth</span>
              <span className="block text-xs text-[color:var(--owi-muted)]">v{appVersion}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="grid h-10 w-10 place-items-center rounded-md border border-[color:var(--owi-border)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto" aria-label="Mobile primary">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold",
                isActivePath(pathname, item.href)
                  ? "bg-moss text-white dark:bg-mist dark:text-ink"
                  : "text-[color:var(--owi-muted)] hover:bg-[color:var(--owi-surface-hover)]"
              )}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge && counts[item.badge] > 0 ? (
                <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-copper px-1.5 text-[11px] font-bold text-white">
                  {counts[item.badge] > 99 ? "99+" : counts[item.badge]}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[color:var(--owi-border)] pt-4">
          <Link href="/profile" onClick={onClose} className="flex items-center gap-3 rounded-md p-2">
            <UserRound className="h-5 w-5" />
            <span className="min-w-0 truncate text-sm font-semibold">{userName}</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="mt-2 flex min-h-10 w-full items-center gap-3 rounded-md p-2 text-sm font-semibold"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
}

export function TopCommandBar({
  title,
  online,
  unreadCount,
  pendingOcrCount,
  userName,
  onMenu,
  onLogout
}: {
  title: string;
  online: boolean;
  unreadCount: number;
  pendingOcrCount: number;
  userName: string;
  onMenu: () => void;
  onLogout: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const localDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date()),
    []
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--owi-border)] bg-[color:var(--owi-command)]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="grid h-10 w-10 place-items-center rounded-md border border-[color:var(--owi-border)] lg:hidden"
            title="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--owi-muted)]">
              <span>{localDate}</span>
              <span className="hidden sm:inline">/</span>
              <span className="inline-flex items-center gap-1">
                {online ? <Wifi className="h-3.5 w-3.5 text-moss" /> : <WifiOff className="h-3.5 w-3.5 text-copper" />}
                {online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <QuickAddMenu pendingOcrCount={pendingOcrCount} />
          <PWAInstallControl />
          <ThemeSelector />
          <button
            type="button"
            title="Notifications"
            onClick={() => setDrawerOpen(true)}
            className="relative grid h-10 w-10 place-items-center rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] hover:bg-[color:var(--owi-surface-hover)]"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-copper px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setUserOpen((current) => !current)}
              className="flex h-10 items-center gap-2 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] px-2.5 text-sm font-semibold hover:bg-[color:var(--owi-surface-hover)]"
            >
              <UserRound className="h-4 w-4" />
              <span className="max-w-32 truncate">{userName}</span>
            </button>
            {userOpen ? (
              <div className={cn("absolute right-0 mt-2 w-56 rounded-lg p-2", surfaceClass)}>
                <Link
                  href="/profile"
                  onClick={() => setUserOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-[color:var(--owi-surface-hover)]"
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setUserOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-[color:var(--owi-surface-hover)]"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}

export function QuickAddMenu({ pendingOcrCount }: { pendingOcrCount: number }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { href: "/entries/new", label: "Daily Entry", icon: <Save className="h-4 w-4" /> },
    { href: "/assets/new", label: "Asset", icon: <BriefcaseBusiness className="h-4 w-4" /> },
    { href: "/goals/new", label: "Goal", icon: <Target className="h-4 w-4" /> },
    { href: "/receipts", label: "Receipt", icon: <ReceiptText className="h-4 w-4" /> },
    { href: "/vault", label: "Vault Document", icon: <FolderArchive className="h-4 w-4" /> },
    { href: "/ocr", label: `OCR Reviews${pendingOcrCount > 0 ? ` (${pendingOcrCount})` : ""}`, icon: <ScanText className="h-4 w-4" /> }
  ];

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className={buttonPrimaryClass}>
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Quick add</span>
      </button>
      {open ? (
        <div className={cn("absolute right-0 mt-2 w-64 rounded-lg p-2", surfaceClass)}>
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-[color:var(--owi-surface-hover)]"
            >
              {action.icon}
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BottomNavigation({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const items = [
    { href: "/dashboard", label: "Home", icon: <Home className="h-5 w-5" /> },
    { href: "/entries/new", label: "Entry", icon: <Save className="h-5 w-5" /> },
    { href: "/portfolio", label: "Portfolio", icon: <ChartPie className="h-5 w-5" /> },
    { href: "/goals", label: "Goals", icon: <Target className="h-5 w-5" /> }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--owi-border)] bg-[color:var(--owi-command)] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden" aria-label="Bottom navigation">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold",
                active ? "bg-moss text-white dark:bg-mist dark:text-ink" : "text-[color:var(--owi-muted)]"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold text-[color:var(--owi-muted)]"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}

function ThemeSelector() {
  const { themePreference, setThemePreference } = useTheme();
  const options = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Smartphone className="h-4 w-4" /> }
  ] as const;

  return (
    <div className="hidden rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-1 md:flex">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.label}
          onClick={() => setThemePreference(option.value)}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md transition",
            themePreference === option.value ? "bg-moss text-white dark:bg-mist dark:text-ink" : "text-[color:var(--owi-muted)] hover:bg-[color:var(--owi-surface-hover)]"
          )}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function PWAInstallControl() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosPromptOpen, setIosPromptOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [isIosStandaloneCandidate] = useState(() => detectIosInstallCandidate());

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("owi:pwa-update-ready", onUpdateReady);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("owi:pwa-update-ready", onUpdateReady);
    };
  }, []);

  if (updateReady) {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={buttonSecondaryClass}
        title="Refresh update"
      >
        <RefreshCw className="h-4 w-4" />
        <span className="hidden xl:inline">Refresh</span>
      </button>
    );
  }

  if (installEvent) {
    return (
      <button
        type="button"
        onClick={() => {
          void installEvent.prompt().finally(() => setInstallEvent(null));
        }}
        className={buttonSecondaryClass}
        title="Install app"
      >
        <Smartphone className="h-4 w-4" />
        <span className="hidden xl:inline">Install</span>
      </button>
    );
  }

  if (isIosStandaloneCandidate) {
    return (
      <div className="relative hidden sm:block">
        <button
          type="button"
          onClick={() => setIosPromptOpen((current) => !current)}
          className={buttonSecondaryClass}
          title="iPhone install"
        >
          <Smartphone className="h-4 w-4" />
        </button>
        {iosPromptOpen ? (
          <div className={cn("absolute right-0 mt-2 w-72 rounded-lg p-4 text-sm leading-6", surfaceClass)}>
            Add to Home Screen from Safari Share to install OWI.
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function detectIosInstallCandidate() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return isIos && !standalone;
}

export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    const data = await apiFetch<NotificationList>("notifications?limit=8");
    setNotifications(data.items);
    setUnreadCount(data.unread_count);
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<NotificationList>("notifications?limit=8");
        if (active) {
          setNotifications(data.items);
          setUnreadCount(data.unread_count);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [open]);

  async function markRead(notificationId: string) {
    try {
      await apiFetch<Notification>(`notifications/${notificationId}/read`, {
        method: "PATCH"
      });
      await loadNotifications();
    } catch (readError) {
      setError(errorMessage(readError));
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close notifications" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-[min(30rem,92vw)] flex-col border-l border-[color:var(--owi-border)] bg-[color:var(--owi-sidebar)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Notifications</h2>
            <p className="mt-1 text-sm text-[color:var(--owi-muted)]">{unreadCount} unread</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md border border-[color:var(--owi-border)]"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {error ? (
          <p className="mt-4 rounded-md border border-copper/30 bg-copper/10 px-3 py-2 text-sm text-copper dark:text-[#ffb088]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex-1 space-y-3 overflow-y-auto">
          {notifications.map((notification) => (
            <article key={notification.id} className="rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{notification.title}</p>
                  <p className="mt-1 line-clamp-3 text-sm leading-6 text-[color:var(--owi-muted)]">
                    {notification.message}
                  </p>
                </div>
                <StatusBadge status={notification.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--owi-muted)]">
                <span>{statusLabel(notification.type)} / {statusLabel(notification.channel)}</span>
                <span>{new Date(notification.created_at).toLocaleString("en-GB")}</span>
              </div>
              {notification.status !== "read" && notification.channel === "in_app" ? (
                <button
                  type="button"
                  onClick={() => void markRead(notification.id)}
                  className="mt-3 rounded-md border border-[color:var(--owi-border)] px-3 py-2 text-xs font-semibold hover:bg-[color:var(--owi-surface-hover)]"
                >
                  Mark read
                </button>
              ) : null}
            </article>
          ))}
          {!notifications.length ? (
            <div className="rounded-lg border border-dashed border-[color:var(--owi-border-strong)] p-5 text-sm text-[color:var(--owi-muted)]">
              No notifications.
            </div>
          ) : null}
        </div>
        <Link
          href="/notifications"
          onClick={onClose}
          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white dark:bg-mist dark:text-ink"
        >
          <Bell className="h-4 w-4" />
          Open notifications
        </Link>
      </aside>
    </div>
  );
}

function pageTitle(pathname: string) {
  const match = routeTitles.find(([route]) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)));
  return match?.[1] ?? "Observer Wealth";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  if (href === "/entries/new") return pathname === "/entries/new";
  if (href === "/entries") return pathname === "/entries" || (pathname.startsWith("/entries/") && pathname !== "/entries/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}
