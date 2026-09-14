const RELOAD_FLAG = "taktikboard:chunk-reload";

/** Erkennt Chunk-/Asset-Ladefehler nach Deployments (PWA/stale cache). */
export function isChunkLoadError(error: unknown): boolean {
  if (error == null) return false;

  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : String(error);

  const name =
    error instanceof Error
      ? error.name
      : typeof error === "object" &&
          error !== null &&
          "name" in error &&
          typeof (error as { name: unknown }).name === "string"
        ? (error as { name: string }).name
        : "";

  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    (/Failed to fetch/i.test(message) &&
      (/chunk/i.test(message) || /static\/chunks/i.test(message) || /_next\//i.test(message)))
  );
}

/**
 * Einmaliger Hard-Reload bei veralteten Build-Chunks.
 * Verhindert Reload-Loops über sessionStorage.
 */
export function recoverFromChunkLoadError(error?: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (error != null && !isChunkLoadError(error)) return false;

  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") {
      sessionStorage.removeItem(RELOAD_FLAG);
      return false;
    }
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage kann in Private Mode fehlen — trotzdem einmal reloaden
  }

  console.warn("[chunkLoadRecovery] Veralteter Chunk — Seite wird neu geladen", error);

  // Service Worker kann alte Builds cachen — vor Reload aktualisieren
  void (async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.update().catch(() => undefined)));
      }
    } catch {
      // ignore
    } finally {
      window.location.reload();
    }
  })();

  return true;
}

export function clearChunkReloadFlag(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // ignore
  }
}
