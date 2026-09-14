import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Entfernt Anführungszeichen/Whitespace, die in Vercel-Env oft versehentlich landen. */
function sanitizeEnvValue(raw: string | undefined): string {
  if (raw == null) return "";
  return raw
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
}

function getSupabaseUrlRaw(): string {
  return sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
}

function getSupabaseAnonKey(): string {
  return sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Öffentliche URL für Diagnose-Toasts (ohne Key). */
export function getSupabaseUrl(): string {
  return getSupabaseUrlRaw();
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigError() == null;
}

/**
 * Strenge Prüfung vor jedem Fetch:
 * - URL/Key vorhanden
 * - URL beginnt mit https://
 * - gültige URL, kein Leerzeichen
 */
export function getSupabaseConfigError(): string | null {
  const url = getSupabaseUrlRaw();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    return "Supabase-URL oder Key fehlt in .env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  }

  if (/\s/.test(url)) {
    return "Supabase-URL enthält Leerzeichen — bitte NEXT_PUBLIC_SUPABASE_URL in Vercel/.env bereinigen.";
  }

  if (!/^https:\/\//i.test(url)) {
    return `Supabase-URL muss mit https:// beginnen (aktuell: "${url.slice(0, 48)}").`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Supabase-URL ist ungültig: ${url}`;
  }

  if (parsed.protocol !== "https:") {
    return `Supabase-URL muss HTTPS nutzen (aktuell: ${parsed.protocol}).`;
  }

  if (!key.startsWith("eyJ") && !key.startsWith("sb_")) {
    // JWT-Anon-Keys beginnen typischerweise mit eyJ; neue sb_publishable Keys mit sb_
    console.warn(
      "[supabase] ANON_KEY sieht ungewöhnlich aus (erwartet eyJ… oder sb_…). Speichern kann scheitern.",
    );
  }

  return null;
}

/**
 * Eager Singleton — wird beim Modul-Import erzeugt (kein await import / kein lazy Chunk).
 * Bei fehlender Config bleibt `supabase` null; Aufrufer prüfen das.
 */
function createSupabaseSingleton(): SupabaseClient | null {
  const configError = getSupabaseConfigError();
  if (configError) {
    if (typeof window !== "undefined") {
      console.warn("[supabase]", configError);
    }
    return null;
  }

  const url = getSupabaseUrlRaw();
  const key = getSupabaseAnonKey();

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          "X-Client-Info": "taktikboard-web",
        },
      },
    });
    if (typeof window !== "undefined") {
      console.info("[supabase] Client initialisiert für", url);
    }
    return client;
  } catch (error) {
    console.error("[supabase] Client-Initialisierung fehlgeschlagen", error);
    return null;
  }
}

/** Statischer Client — sofort im Bundle, kein dynamisches Nachladen. */
export const supabase: SupabaseClient | null = createSupabaseSingleton();

/** @deprecated Nutze `supabase` — bleibt für bestehende Aufrufer. */
export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

/** Toast-Text für TypeError Failed to fetch inkl. Ziel-URL. */
export function formatNetworkFetchError(error?: unknown): string {
  const url = getSupabaseUrlRaw() || "(NEXT_PUBLIC_SUPABASE_URL leer)";
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Failed to fetch";
  return `Netzwerk/CORS-Fehler beim Aufruf von: ${url} (${detail})`;
}
