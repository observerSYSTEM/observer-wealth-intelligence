"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-copper/30 bg-copper/10 px-3 py-2 text-sm font-medium text-copper dark:text-[#ffb088]">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Offline: showing saved read-only data.</span>
    </div>
  );
}
