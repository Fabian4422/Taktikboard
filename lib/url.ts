/** URL ohne Next soft-navigation aktualisieren (kein Chunk-Nachladen). */
export function replaceUrlQuietly(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(window.history.state, "", url);
  } catch (error) {
    console.warn("[replaceUrlQuietly] fehlgeschlagen", error);
  }
}
