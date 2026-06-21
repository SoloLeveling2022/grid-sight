"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // Unregister any active service worker in development to avoid caching/hydration issues
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log("[PWA] Unregistered service worker for development mode.");
                window.location.reload();
              }
            });
          }
        });
      }
      return;
    }

    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || 
       window.location.hostname === "localhost" ||
       window.location.hostname === "127.0.0.1")
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registered successfully on scope:", registration.scope);
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}
