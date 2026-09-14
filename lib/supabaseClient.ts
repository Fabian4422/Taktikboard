/**
 * Re-Export für bestehende Imports aus `@/lib/supabaseClient`.
 * Kanonische Quelle: `@/lib/supabase` (eager Singleton).
 */
export {
  supabase,
  getSupabaseClient,
  isSupabaseConfigured,
  getSupabaseConfigError,
  getSupabaseUrl,
  formatNetworkFetchError,
} from "./supabase";
