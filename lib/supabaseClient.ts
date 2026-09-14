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

let client: SupabaseClient | null = null;

/**
 * Browser-Client aus den NEXT_PUBLIC_ Umgebungsvariablen.
 * Gibt `null` zurück statt zu werfen, wenn Env-Variablen fehlen oder
 * die Initialisierung fehlschlägt — Aufrufer müssen das prüfen.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const configError = getSupabaseConfigError();
  if (configError) {
    console.warn("[supabase]", configError);
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!client) {
    try {
      client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (...args) => {
            // Expliziter Fetch, damit Netzwerkfehler im Aufrufer-try/catch landen
            return fetch(...args);
          },
        },
      });
    } catch (error) {
      console.error("[supabase] Client-Initialisierung fehlgeschlagen", error);
      return null;
    }
  }

  return client;
}
