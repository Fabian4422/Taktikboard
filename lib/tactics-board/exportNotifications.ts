const TITLE_BASE = "Taktikboard";

export function setExportTabTitle(percent: number) {
  if (typeof document === "undefined") return;
  document.title = `(${Math.max(0, Math.min(100, Math.round(percent)))}%) ${TITLE_BASE}`;
}

export function restoreTabTitle(previousTitle: string) {
  if (typeof document === "undefined") return;
  document.title = previousTitle || TITLE_BASE;
}

export async function requestExportNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function notifyExportComplete(kind: "video" | "gif") {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const body =
    kind === "gif"
      ? "Dein Taktik-GIF ist fertig aufbereitet und bereit zum Download!"
      : "Dein Taktik-Video ist fertig aufbereitet und bereit zum Download!";

  try {
    new Notification("Taktikboard", {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });
  } catch {
    // Manche Browser blockieren Notifications ohne Service Worker – UI reicht dann.
  }
}
