"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function ConnectionStatus() {
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

  return (
    <span
      title={online ? "Online" : "Offline"}
      className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-white/10"
    >
      {online ? (
        <Wifi className="h-5 w-5 text-moss dark:text-mist" aria-hidden="true" />
      ) : (
        <WifiOff className="h-5 w-5 text-copper" aria-hidden="true" />
      )}
      <span className="sr-only">{online ? "Online" : "Offline"}</span>
    </span>
  );
}
