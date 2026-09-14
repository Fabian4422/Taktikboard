import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** Klare Diagnose, wenn Env-Variablen fehlen oder leer sind. */
export function getSupabaseConfigError(): string | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url && !key) {
    return "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen).";
  }
  if (!url) {
    return "Supabase-URL fehlt (NEXT_PUBLIC_SUPABASE_URL ist undefined/leer).";
  }
  if (!key) {
    return "Supabase-Anon-Key fehlt (NEXT_PUBLIC_SUPABASE_ANON_KEY ist undefined/leer).";
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return `Supabase-URL ist ungültig: ${url}`;
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

  try {
    return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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
