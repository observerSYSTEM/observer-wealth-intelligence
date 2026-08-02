"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent("owi:pwa-update-ready"));
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("owi:pwa-update-ready"));
            }
          });
        });
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV === "development") {
          console.error("PWA registration failed", error);
        }
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.dispatchEvent(new CustomEvent("owi:pwa-update-ready"));
    });
  }, []);

  return null;
}
