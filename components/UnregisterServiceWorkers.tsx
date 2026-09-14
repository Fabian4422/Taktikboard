"use client";

import { useEffect } from "react";

/**
 * Entfernt alte PWA-Service-Worker und deren Caches.
 * Verhindert Failed to fetch auf veraltete `/_next/static/chunks/*` nach Deployments.
 */
export function UnregisterServiceWorkers() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
        if (regs.length > 0) {
          console.info(
            `[UnregisterServiceWorkers] ${regs.length} Service Worker unregistriert`,
          );
        }
      } catch (error) {
        console.warn("[UnregisterServiceWorkers] unregister fehlgeschlagen", error);
      }

      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
          if (keys.length > 0) {
            console.info(`[UnregisterServiceWorkers] ${keys.length} Cache(s) gelöscht`);
          }
        }
      } catch (error) {
        console.warn("[UnregisterServiceWorkers] Cache-Löschung fehlgeschlagen", error);
      }
    })();
  }, []);

  return null;
}
