import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

let client: SupabaseClient | null = null;

/**
 * Browser-Client aus den NEXT_PUBLIC_ Umgebungsvariablen.
 * Gibt `null` zurück statt zu werfen, wenn Env-Variablen fehlen oder
 * die Initialisierung fehlschlägt — Aufrufer müssen das prüfen.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    return null;
  }

  if (!client) {
    try {
      client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch (error) {
      console.error("[supabase] Client-Initialisierung fehlgeschlagen", error);
      return null;
    }
  }

  return client;
}
