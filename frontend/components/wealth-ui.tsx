"use client";

import {
  AlertCircle,
  Archive,
  CheckCircle2,
  CircleDollarSign,
  FileUp,
  FolderOpen,
  Search,
  ShieldCheck
} from "lucide-react";
import type {
  ChangeEvent,
  DragEvent,
  HTMLInputTypeAttribute,
  InputHTMLAttributes,
  ReactNode
} from "react";

import { formatFileSize, formatMoney, formatPercent, statusLabel } from "@/lib/format";
import type { CategoryValue, Goal, OCRResult, TimelineEvent } from "@/types/finance";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const surfaceClass =
  "border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] shadow-[0_18px_50px_rgba(16,24,32,0.08)] dark:shadow-none";

export const buttonPrimaryClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss/90 focus:outline-none focus:ring-2 focus:ring-moss focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-mist dark:focus:ring-offset-ink";

export const buttonSecondaryClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[color:var(--owi-surface-hover)] focus:outline-none focus:ring-2 focus:ring-moss focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-mist dark:focus:ring-offset-ink";

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  icon,
  actions
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 py-2">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-elevated)] text-moss dark:text-mist">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--owi-muted)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1 text-balance text-2xl font-semibold tracking-normal sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--owi-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg p-5", surfaceClass, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--owi-surface-elevated)] text-moss dark:text-mist">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-[color:var(--owi-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "info";
}) {
  const toneClass = {
    neutral: "text-moss dark:text-mist",
    positive: "text-emerald-700 dark:text-emerald-300",
    warning: "text-copper dark:text-[#ffb088]",
    info: "text-sky-700 dark:text-sky-300"
  }[tone];

  return (
    <article className={cn("min-h-32 rounded-lg p-4", surfaceClass)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[color:var(--owi-muted)]">{label}</p>
        {icon ? (
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--owi-surface-elevated)]",
              toneClass
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-5 break-words text-2xl font-semibold tracking-normal">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-5 text-[color:var(--owi-muted)]">{detail}</p> : null}
    </article>
  );
}

export function StatusBadge({
  status,
  tone
}: {
  status: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const inferredTone =
    tone ??
    (["active", "confirmed", "complete", "completed", "verified", "read", "target_met", "above_target"].includes(status)
      ? "success"
      : ["failed", "failure", "cancelled", "deleted", "below_target"].includes(status)
        ? "danger"
        : ["review_required", "pending", "queued", "running", "warning"].includes(status)
          ? "warning"
          : "neutral");
  const toneClass = {
    neutral: "border-black/10 bg-black/5 text-ink dark:border-white/10 dark:bg-white/10 dark:text-white",
    success:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    warning: "border-copper/25 bg-copper/10 text-copper dark:text-[#ffb088]",
    danger: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
    info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"
  }[inferredTone];

  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center rounded-md border px-2.5 py-1 text-xs font-semibold capitalize leading-none",
        toneClass
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  icon,
  action
}: {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--owi-border-strong)] bg-[color:var(--owi-surface-muted)] p-5 text-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--owi-surface)] text-moss dark:text-mist">
          {icon ?? <Archive className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {message ? <p className="mt-1 leading-6 text-[color:var(--owi-muted)]">{message}</p> : null}
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)]",
        className
      )}
    />
  );
}

export function CurrencySelector({
  value,
  currencies,
  onChange,
  totals
}: {
  value: string;
  currencies: string[];
  onChange: (currency: string) => void;
  totals?: Array<{ currency: string; total_value?: string; total_actual_savings?: string }>;
}) {
  const uniqueCurrencies = Array.from(new Set(currencies.length ? currencies : ["GBP", "USD", "NGN", "EUR"]));

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Currency">
      {uniqueCurrencies.map((currency) => {
        const active = currency === value;
        const total = totals?.find((item) => item.currency === currency);
        const amount = total?.total_value ?? total?.total_actual_savings;
        return (
          <button
            key={currency}
            type="button"
            onClick={() => onChange(currency)}
            className={cn(
              "min-h-10 rounded-md border px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-moss dark:focus:ring-mist",
              active
                ? "border-moss bg-moss text-white dark:border-mist dark:bg-mist dark:text-ink"
                : "border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] hover:bg-[color:var(--owi-surface-hover)]"
            )}
            aria-pressed={active}
          >
            <span>{currency}</span>
            {amount ? <span className="ml-2 text-xs opacity-75">{formatMoney(amount, currency)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function GoalProgress({
  goal,
  label,
  progress,
  amountLabel,
  targetLabel
}: {
  goal?: Goal;
  label?: string;
  progress?: string | number;
  amountLabel?: string;
  targetLabel?: string;
}) {
  const progressValue = Number(goal?.progress_percentage ?? progress ?? 0);
  const clamped = Math.max(0, Math.min(progressValue, 100));
  const title = goal?.name ?? label ?? "Goal progress";
  const current = goal ? formatMoney(goal.current_amount, goal.currency) : amountLabel;
  const target = goal ? formatMoney(goal.target_amount, goal.currency) : targetLabel;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--owi-muted)]">{title}</p>
          <p className="mt-1 text-3xl font-semibold">{formatPercent(progressValue)}</p>
        </div>
        {current || target ? (
          <p className="text-right text-sm text-[color:var(--owi-muted)]">
            {current ?? ""}
            {current && target ? " / " : ""}
            {target ?? ""}
          </p>
        ) : null}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[color:var(--owi-surface-elevated)]">
        <div className="h-full rounded-full bg-moss dark:bg-mist" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

const chartColors = ["#3D5A40", "#B76E35", "#2D6A8E", "#7B6D4F", "#4D7C78", "#8E5B45"];

export function AllocationChart({
  rows,
  showAmounts = true
}: {
  rows: CategoryValue[];
  showAmounts?: boolean;
}) {
  const visible = rows.filter((row) => Number(row.total_value) > 0);
  if (!visible.length) {
    return (
      <EmptyState
        title="No allocation yet"
        message="Add assets to see category weighting."
        icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex h-4 overflow-hidden rounded-full bg-[color:var(--owi-surface-elevated)]">
        {visible.map((row, index) => (
          <span
            key={row.category}
            title={`${statusLabel(row.category)} ${formatPercent(row.allocation_percentage)}`}
            className="h-full"
            style={{
              width: `${Math.max(Number(row.allocation_percentage), 1)}%`,
              backgroundColor: chartColors[index % chartColors.length]
            }}
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((row, index) => (
          <div key={row.category} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: chartColors[index % chartColors.length] }}
              aria-hidden="true"
            />
            <span className="min-w-0 truncate font-medium capitalize">{statusLabel(row.category)}</span>
            <span className="text-right text-[color:var(--owi-muted)]">
              {formatPercent(row.allocation_percentage)}
              {showAmounts ? ` · ${formatMoney(row.total_value, row.currency)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityTimeline({
  items,
  emptyTitle = "No activity yet"
}: {
  items: TimelineEvent[];
  emptyTitle?: string;
}) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} icon={<FolderOpen className="h-4 w-4" aria-hidden="true" />} />;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[color:var(--owi-border)]">
      {items.map((item) => (
        <li key={item.id} className="relative grid grid-cols-[2rem_1fr] gap-3">
          <span className="z-10 mt-1 grid h-8 w-8 place-items-center rounded-full border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)]">
            <span className="h-2.5 w-2.5 rounded-full bg-moss dark:bg-mist" />
          </span>
          <div className="rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{item.title}</p>
                {item.summary ? (
                  <p className="mt-1 text-sm leading-6 text-[color:var(--owi-muted)]">{item.summary}</p>
                ) : null}
              </div>
              <StatusBadge status={item.event_type} tone="info" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--owi-muted)]">
              <span>{new Date(item.occurred_at).toLocaleString("en-GB")}</span>
              {item.amount && item.currency ? (
                <span className="font-semibold text-[color:var(--owi-text)]">
                  {formatMoney(item.amount, item.currency)}
                </span>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SearchInput({
  id,
  value,
  onChange,
  placeholder = "Search",
  type = "search",
  ...props
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type">) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--owi-muted)]" />
      <input
        id={id}
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface)] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-moss dark:focus:ring-mist",
          props.className
        )}
        {...props}
      />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className={cn("grid gap-3 rounded-lg p-4", surfaceClass)}>
      {children}
    </div>
  );
}

export function FileUploader({
  id,
  label,
  accept,
  file,
  onFileChange,
  disabled,
  helper
}: {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  helper?: string;
}) {
  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (disabled) return;
    onFileChange(event.dataTransfer.files?.[0] ?? null);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null);
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        className={cn(
          "flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--owi-border-strong)] bg-[color:var(--owi-surface-muted)] p-5 text-center transition hover:bg-[color:var(--owi-surface-hover)]",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-md bg-[color:var(--owi-surface)] text-moss dark:text-mist">
          <FileUp className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="mt-3 text-sm font-semibold">{label}</span>
        <span className="mt-1 text-xs leading-5 text-[color:var(--owi-muted)]">
          {file ? `${file.name} · ${formatFileSize(file.size)}` : helper}
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  busy
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className={cn("w-full max-w-md rounded-lg p-5", surfaceClass)}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-copper/10 text-copper">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--owi-muted)]">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={buttonSecondaryClass}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={buttonPrimaryClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OCRReviewPanel({
  result,
  children,
  actions
}: {
  result: OCRResult;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className={cn("rounded-lg p-5", surfaceClass)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-moss dark:text-mist" aria-hidden="true" />
            <p className="font-semibold capitalize">{statusLabel(result.source_type)}</p>
          </div>
          <p className="mt-1 text-sm text-[color:var(--owi-muted)]">
            Confidence {formatPercent(result.confidence_score)}
          </p>
        </div>
        <StatusBadge status={result.status} />
      </div>
      {result.amount && result.currency ? (
        <p className="mt-5 text-3xl font-semibold">{formatMoney(result.amount, result.currency)}</p>
      ) : null}
      {result.failure_message ? (
        <p className="mt-4 rounded-md border border-copper/30 bg-copper/10 p-3 text-sm text-copper dark:text-[#ffb088]">
          {result.failure_message}
        </p>
      ) : null}
      <pre className="mt-5 max-h-64 overflow-auto rounded-md bg-[color:var(--owi-surface-muted)] p-3 text-xs leading-5">
        {result.extracted_text || "No text extracted."}
      </pre>
      <div className="mt-5">{children}</div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      <div className="mt-4 flex items-center gap-2 rounded-md border border-[color:var(--owi-border)] bg-[color:var(--owi-surface-muted)] px-3 py-2 text-xs text-[color:var(--owi-muted)]">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-moss dark:text-mist" aria-hidden="true" />
        <span>Review is required before OCR fields are saved.</span>
      </div>
    </article>
  );
}
