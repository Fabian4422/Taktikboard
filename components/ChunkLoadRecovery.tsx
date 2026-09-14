"use client";

import { useEffect } from "react";
import {
  clearChunkReloadFlag,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "@/lib/chunkLoadRecovery";

/**
 * Fängt Chunk-Load-Fehler nach Vercel-Deployments ab (PWA/stale Tabs),
 * statt die App hart abstürzen zu lassen.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    clearChunkReloadFlag();

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return;
      event.preventDefault();
      recoverFromChunkLoadError(event.reason);
    };

    const onError = (event: ErrorEvent) => {
      const candidate = event.error ?? event.message;
      if (!isChunkLoadError(candidate)) return;
      event.preventDefault();
      recoverFromChunkLoadError(candidate);
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
