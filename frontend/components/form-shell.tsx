import type { ReactNode } from "react";

export function Field({
  id,
  label,
  children
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-moss dark:border-white/15 dark:bg-white/10";

export function FormMessage({
  children,
  tone
}: {
  children: string | null;
  tone: "error" | "success";
}) {
  if (!children) return null;
  const toneClass =
    tone === "error"
      ? "border-copper/30 bg-copper/10 text-copper dark:text-[#ffb088]"
      : "border-moss/30 bg-moss/10 text-moss dark:text-mist";

  return (
    <p className={`rounded-md border px-3 py-2 text-sm font-medium ${toneClass}`} role="status">
      {children}
    </p>
  );
}
