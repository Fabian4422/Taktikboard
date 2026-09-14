const RELOAD_FLAG = "taktikboard:chunk-reload";

function errorMessage(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "";
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  try {
    return String(error);
  } catch {
    return "";
  }
}

function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name: unknown }).name === "string"
  ) {
    return (error as { name: string }).name;
  }
  return "";
}

/** Erkennt Chunk-/Asset-Ladefehler nach Deployments (PWA/stale cache). */
export function isChunkLoadError(error: unknown): boolean {
  if (error == null) return false;

  const message = errorMessage(error);
  const name = errorName(error);

  if (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    (/Failed to fetch/i.test(message) &&
      (/chunk/i.test(message) || /static\/chunks/i.test(message) || /_next\//i.test(message)))
  ) {
    return true;
  }

  // Webpack/Next wirft bei fehlgeschlagenem lazy-Chunk oft nur nacktes TypeError: Failed to fetch
  if (name === "TypeError" && /^failed to fetch$/i.test(message.trim())) {
    return true;
  }

  return false;
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

  void (async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs.map(async (reg) => {
            try {
              await reg.update();
            } catch {
              // ignore
            }
            // Alten SW nicht ewig festhalten
            if (reg.waiting) {
              reg.waiting.postMessage({ type: "SKIP_WAITING" });
            }
          }),
        );
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

/** URL ohne Next soft-navigation aktualisieren (kein Chunk-Nachladen). */
export function replaceUrlQuietly(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(window.history.state, "", url);
  } catch (error) {
    console.warn("[replaceUrlQuietly] fehlgeschlagen", error);
  }
}
