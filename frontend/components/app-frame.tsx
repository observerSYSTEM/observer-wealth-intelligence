import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export function AppFrame({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
