import type { FieldRotation, FieldView, Keyframe, TacticsBoardDocument } from "./types";
import { FIELD_HEIGHT, FIELD_WIDTH } from "./types";
import { migrateTacticsDocument } from "./fieldLayout";
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfigError,
  getSupabaseUrl,
  formatNetworkFetchError,
} from "@/lib/supabase";
import { createId } from "@/lib/uuid";
import type { SupabaseClient } from "@supabase/supabase-js";

export { isSupabaseConfigured, getSupabaseConfigError, getSupabaseUrl, formatNetworkFetchError };

// Eager-Bindung: kein lazy Nachladen von @supabase beim ersten Save/List
void supabase;

/** ~900 KB JSON — unter typischen API-Gateway-Limits; Base64-Bilder wären zu groß. */
const MAX_BOARD_DATA_BYTES = 900_000;

/** Sicheres Trim — nie auf Non-Strings `.trim()` aufrufen. */
export function safeTrim(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** Fehlermeldung sicher als String (vermeidet `r.trim is not a function`). */
export function safeErrorMessage(err: unknown, fallback = "Unbekannter Fehler"): string {
  if (typeof err === "string") {
    const t = err.trim();
    return t || fallback;
  }
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  if (err && typeof err === "object" && "error" in err) {
    const nested = (err as { error?: unknown }).error;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}

/** Aktuelle Speichertabelle (nicht `tactics_boards` / `boards`). */
export const TACTICS_TABLE = "tactics";
export const TACTICS_VIDEO_BUCKET = "tactics-videos";
const LOAD_FAILURE_MESSAGE = "Übung konnte nicht geladen werden";

export interface BoardData {
  keyframes: Keyframe[];
  fieldWidth: number;
  fieldHeight: number;
  fieldView?: FieldView;
  fieldRotation?: FieldRotation;
  coordSpace?: "field" | "viewport";
}

export interface TacticExportFile {
  blob: Blob;
  filename: string;
  mimeType: string;
}

export interface TacticSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string | null;
  video_url: string | null;
}

export interface TacticRecord extends TacticSummary {
  board_data: BoardData;
}

export interface SaveTacticResult {
  success: boolean;
  id?: string;
  videoUrl?: string | null;
  error?: string;
}

export interface SaveTacticsBoardOptions {
  exerciseId?: string;
  name?: string;
}

export type SaveTacticsBoardResult = SaveTacticResult;

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Serialisiert Board-Daten ausschließlich für die JSONB-Spalte `board_data`.
 * Textfelder, Schrittdauern usw. liegen in keyframes[].elements — nie als Tabellen-Spalten.
 */
function documentToBoardData(document: TacticsBoardDocument): BoardData {
  const raw: BoardData = {
    keyframes: document.keyframes ?? [],
    fieldWidth: document.fieldWidth,
    fieldHeight: document.fieldHeight,
    fieldView: document.fieldView,
    fieldRotation: document.fieldRotation,
    coordSpace: document.coordSpace ?? "viewport",
  };
  try {
    const parsed = JSON.parse(JSON.stringify(raw)) as BoardData;
    // Nur bekannte JSONB-Keys — keine fremden Root-Felder aus dem Dokument
    return {
      keyframes: Array.isArray(parsed.keyframes) ? parsed.keyframes : [],
      fieldWidth: parsed.fieldWidth,
      fieldHeight: parsed.fieldHeight,
      ...(parsed.fieldView ? { fieldView: parsed.fieldView } : {}),
      ...(parsed.fieldRotation != null ? { fieldRotation: parsed.fieldRotation } : {}),
      coordSpace: parsed.coordSpace ?? "viewport",
    };
  } catch (error) {
    console.error("[tactics/supabase] board_data JSON-Serialisierung fehlgeschlagen", error);
    throw new Error(
      `board_data nicht serialisierbar: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Nur Spalten, die in public.tactics existieren (002_tactics.sql). */
function buildTacticsWritePayload(params: {
  title: string;
  boardData: BoardData;
  videoUrl?: string | null;
  includeVideoUrl: boolean;
}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    title: params.title,
    board_data: params.boardData,
  };
  if (params.includeVideoUrl) {
    row.video_url = params.videoUrl ?? null;
  }
  return row;
}

function measurePayloadBytes(payload: Record<string, unknown>): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return JSON.stringify(payload).length;
  }
}

/** Lehnt übergroße Payloads ab (z. B. versehentliche Base64-Bilder in board_data). */
function assertPayloadSize(payload: Record<string, unknown>): string | null {
  const bytes = measurePayloadBytes(payload);
  if (bytes > MAX_BOARD_DATA_BYTES) {
    return `Payload zu groß (${Math.round(bytes / 1024)} KB). Bitte keine Base64-Bilder im Board speichern — max. ~${Math.round(MAX_BOARD_DATA_BYTES / 1024)} KB.`;
  }
  // Heuristik: data-URLs / riesige base64-Strings
  const asText = JSON.stringify(payload.board_data ?? {});
  if (/data:image\/[a-zA-Z+]+;base64,/i.test(asText) || /data:video\//i.test(asText)) {
    return "board_data enthält eingebettete Base64-Medien. Bitte entfernen — Speichern würde am Body-Limit scheitern.";
  }
  return null;
}

function isFailedToFetchError(error: unknown): boolean {
  const text = extractSupabaseErrorText(error, "");
  return /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(text);
}

function networkOrExtractError(error: unknown): string {
  if (isFailedToFetchError(error)) {
    return formatNetworkFetchError(error);
  }
  return extractSupabaseErrorText(error);
}

/** Extrahiert message / details / hint oder JSON — nie eine Pauschalmeldung. */
export function extractSupabaseErrorText(error: unknown, fallback = "Unbekannter Speichern-Fehler"): string {
  if (error == null || error === "") return fallback;

  if (typeof error === "string") {
    return error.trim() || fallback;
  }

  if (error instanceof Error) {
    const anyErr = error as Error & SupabaseLikeError;
    const parts = [
      typeof anyErr.message === "string" ? anyErr.message.trim() || null : null,
      typeof anyErr.details === "string" ? anyErr.details : null,
      typeof anyErr.hint === "string" ? `hint=${anyErr.hint}` : null,
      typeof anyErr.code === "string" ? `code=${anyErr.code}` : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }

  if (isPlainObject(error)) {
    const message = typeof error.message === "string" ? error.message.trim() : "";
    const details = typeof error.details === "string" ? error.details.trim() : "";
    const hint = typeof error.hint === "string" ? error.hint.trim() : "";
    const code = typeof error.code === "string" ? error.code.trim() : "";
    if (message || details || hint || code) {
      return [message || null, details || null, hint ? `hint=${hint}` : null, code ? `code=${code}` : null]
        .filter(Boolean)
        .join(" | ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }

  return safeErrorMessage(error, fallback);
}

function boardDataToDocument(
  id: string,
  title: string,
  boardData: BoardData,
): TacticsBoardDocument {
  return migrateTacticsDocument({
    id,
    name: title,
    keyframes: boardData.keyframes ?? [],
    fieldWidth: boardData.fieldWidth ?? FIELD_WIDTH,
    fieldHeight: boardData.fieldHeight ?? FIELD_HEIGHT,
    fieldView: boardData.fieldView,
    fieldRotation: boardData.fieldRotation,
    coordSpace: boardData.coordSpace,
  });
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "uebung";
}

function extensionFromFilename(filename: string, mimeType: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 5) {
    return fromName;
  }
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webm")) return "webm";
  return "mp4";
}

/** Formatiert Supabase/PostgREST-Fehler inkl. message/details/hint für Toast + Konsole. */
export function formatSupabaseError(
  error: SupabaseLikeError | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  const text = extractSupabaseErrorText(error, fallback);
  if (/row-level security|rls/i.test(text) || error.code === "42501") {
    return `Fehler beim Speichern: Row Level Security blockiert (${text})`;
  }
  return text;
}

/** Erkennt typische Netzwerk-/Fetch-Fehler (Tablet, PWA, Offline). */
function isNetworkFetchError(message: string): boolean {
  return /failed to fetch|networkerror|load failed|fetch failed|network request failed|err_network|typeerror:\s*failed to fetch/i.test(
    message,
  );
}

/** Extrahiert lesbare Speichern-Fehler — immer die konkrete Meldung, nie Pauschaltext. */
export function toSaveUserMessage(
  error: unknown,
  fallback = "Fehler beim Speichern in Supabase",
): string {
  if (isFailedToFetchError(error)) {
    return formatNetworkFetchError(error);
  }
  const text = extractSupabaseErrorText(error, fallback);
  if (isNetworkFetchError(text)) {
    return formatNetworkFetchError(error);
  }
  return text;
}

function logSupabase(label: string, payload: Record<string, unknown>) {
  console.log(`[tactics/supabase] ${label}`, payload);
}

async function uploadTacticVideo(
  title: string,
  video: TacticExportFile,
): Promise<{ publicUrl: string }> {
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).");
  }

  const ext = extensionFromFilename(video.filename, video.mimeType);
  const path = `${slugify(title)}-${createId()}.${ext}`;

  const { error } = await supabase.storage.from(TACTICS_VIDEO_BUCKET).upload(path, video.blob, {
    contentType: video.mimeType || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`Video-Upload fehlgeschlagen: ${error.message}`);
  }

  const { data } = supabase.storage.from(TACTICS_VIDEO_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("Öffentliche Video-URL konnte nicht ermittelt werden.");
  }

  return { publicUrl: data.publicUrl };
}

/**
 * Speichert eine Übung in der Tabelle `tactics` (JSONB board_data).
 * `client` für Server-Proxy; sonst Browser-Singleton.
 */
export async function saveTactic(
  params: {
    title: string;
    boardData: BoardData;
    video?: TacticExportFile | null;
  },
  client: SupabaseClient | null = supabase,
): Promise<SaveTacticResult> {
  const configError = getSupabaseConfigError();
  if (configError) {
    return { success: false, error: configError };
  }

  const title = safeTrim(params.title);
  if (!title) {
    return { success: false, error: "Bitte einen Titel für die Übung eingeben." };
  }

  try {
    let videoUrl: string | null = null;
    if (params.video?.blob && params.video.blob.size > 0) {
      try {
        const uploaded = await uploadTacticVideo(title, params.video);
        videoUrl = uploaded.publicUrl;
      } catch (uploadError) {
        return { success: false, error: toSaveUserMessage(uploadError, "Video-Upload fehlgeschlagen.") };
      }
    }

    const payload = buildTacticsWritePayload({
      title,
      boardData: params.boardData,
      videoUrl,
      includeVideoUrl: true,
    });

    const sizeError = assertPayloadSize(payload);
    if (sizeError) {
      return { success: false, error: sizeError };
    }

    logSupabase("INSERT start", {
      table: TACTICS_TABLE,
      title,
      payloadKeys: Object.keys(payload),
      payloadBytes: measurePayloadBytes(payload),
      keyframeCount: params.boardData.keyframes?.length ?? 0,
      hasVideo: Boolean(videoUrl),
      supabaseUrl: getSupabaseUrl() || null,
      userIdFilter: null,
    });

    if (!client) {
      return {
        success: false,
        error:
          getSupabaseConfigError() ??
          "Supabase-URL oder Key fehlt in .env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      };
    }

    let data: { id: string } | null = null;
    let error: SupabaseLikeError | null = null;
    try {
      const result = await client.from(TACTICS_TABLE).insert(payload).select("id").single();
      data = result.data;
      error = result.error;
    } catch (fetchError) {
      console.error("[tactics/supabase] INSERT fetch exception", fetchError);
      return { success: false, error: networkOrExtractError(fetchError) };
    }

    logSupabase("INSERT result", { data, error });

    if (error) {
      const message = formatSupabaseError(
        error,
        "Speichern fehlgeschlagen (möglicherweise RLS/Schema).",
      );
      console.error("[tactics/supabase] INSERT error", error);
      return { success: false, error: message };
    }

    if (!data?.id) {
      const message =
        "Speichern lieferte keine ID zurück (INSERT ohne sichtbare Zeile — oft fehlende SELECT-RLS).";
      console.error("[tactics/supabase] INSERT ohne id", { data, error });
      return { success: false, error: message };
    }

    try {
      const verify = await client
        .from(TACTICS_TABLE)
        .select("id, title")
        .eq("id", data.id)
        .maybeSingle();

      logSupabase("INSERT verify SELECT", {
        id: data.id,
        data: verify.data,
        error: verify.error,
      });

      if (verify.error || !verify.data) {
        const message = formatSupabaseError(
          verify.error,
          "Übung wurde geschrieben, ist aber nicht lesbar (SELECT-RLS für Role „anon“ fehlt).",
        );
        console.error("[tactics/supabase] INSERT verify failed — Bibliothek bleibt leer", verify);
        return { success: false, error: message };
      }
    } catch (verifyError) {
      console.error("[tactics/supabase] INSERT verify exception", verifyError);
      return { success: false, error: toSaveUserMessage(verifyError) };
    }

    return { success: true, id: data.id, videoUrl };
  } catch (error) {
    console.error("[tactics/supabase] INSERT exception", error);
    return {
      success: false,
      error: toSaveUserMessage(error),
    };
  }
}

/** Aktualisiert eine bestehende Übung in der Tabelle `tactics`. */
export async function updateTactic(
  params: {
    id: string;
    title: string;
    boardData: BoardData;
    video?: TacticExportFile | null;
  },
  client: SupabaseClient | null = supabase,
): Promise<SaveTacticResult> {
  const configError = getSupabaseConfigError();
  if (configError) {
    return { success: false, error: configError };
  }

  const title = safeTrim(params.title);
  if (!title) {
    return { success: false, error: "Bitte einen Titel für die Übung eingeben." };
  }

  try {
    let videoUrl: string | null | undefined;
    if (params.video?.blob && params.video.blob.size > 0) {
      try {
        const uploaded = await uploadTacticVideo(title, params.video);
        videoUrl = uploaded.publicUrl;
      } catch (uploadError) {
        return { success: false, error: toSaveUserMessage(uploadError, "Video-Upload fehlgeschlagen.") };
      }
    }

    const payload = buildTacticsWritePayload({
      title,
      boardData: params.boardData,
      videoUrl,
      includeVideoUrl: videoUrl !== undefined,
    });

    const sizeError = assertPayloadSize(payload);
    if (sizeError) {
      return { success: false, error: sizeError };
    }

    logSupabase("UPDATE start", {
      table: TACTICS_TABLE,
      id: params.id,
      title,
      payloadKeys: Object.keys(payload),
      payloadBytes: measurePayloadBytes(payload),
      supabaseUrl: getSupabaseUrl() || null,
    });

    if (!client) {
      return {
        success: false,
        error:
          getSupabaseConfigError() ??
          "Supabase-URL oder Key fehlt in .env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      };
    }

    let data: { id: string; video_url: string | null } | null = null;
    let error: SupabaseLikeError | null = null;
    try {
      const result = await client
        .from(TACTICS_TABLE)
        .update(payload)
        .eq("id", params.id)
        .select("id, video_url")
        .single();
      data = result.data;
      error = result.error;
    } catch (fetchError) {
      console.error("[tactics/supabase] UPDATE fetch exception", fetchError);
      return { success: false, error: networkOrExtractError(fetchError) };
    }

    logSupabase("UPDATE result", { data, error });

    if (error) {
      const message = formatSupabaseError(error, "Aktualisieren fehlgeschlagen.");
      console.error("[tactics/supabase] UPDATE error", error);
      return { success: false, error: message };
    }

    if (!data?.id) {
      return {
        success: false,
        error:
          "Update änderte keine sichtbare Zeile (ID existiert nicht oder UPDATE/SELECT-RLS blockiert).",
      };
    }

    return { success: true, id: data.id, videoUrl: data.video_url };
  } catch (error) {
    console.error("[tactics/supabase] UPDATE exception", error);
    return {
      success: false,
      error: toSaveUserMessage(error),
    };
  }
}

/**
 * Server-/direkter Speichern-Pfad mit übergebenem Supabase-Client (API-Proxy).
 */
export async function saveTacticsBoardWithClient(
  client: SupabaseClient,
  document: TacticsBoardDocument,
  options: SaveTacticsBoardOptions = {},
): Promise<SaveTacticsBoardResult> {
  try {
    const title = safeTrim(options.name ?? document.name);
    if (!title) {
      return { success: false, error: "Bitte einen Titel für die Übung eingeben." };
    }

    let boardData: BoardData;
    try {
      boardData = documentToBoardData(document);
    } catch (serializeError) {
      return { success: false, error: toSaveUserMessage(serializeError) };
    }

    const existingId = safeTrim(document.id) || undefined;

    logSupabase("saveTacticsBoardWithClient", {
      title,
      existingId: existingId ?? null,
      mode: existingId ? "update" : "insert",
      table: TACTICS_TABLE,
      keyframeCount: boardData.keyframes.length,
      boardDataBytes: JSON.stringify(boardData).length,
    });

    if (existingId) {
      const updated = await updateTactic({ id: existingId, title, boardData }, client);
      if (updated.success) return updated;

      const looksMissing = /keine sichtbare Zeile|PGRST116|0 rows|not found|does not exist/i.test(
        safeErrorMessage(updated.error, ""),
      );
      if (looksMissing) {
        return await saveTactic({ title, boardData }, client);
      }
      return updated;
    }

    return await saveTactic({ title, boardData }, client);
  } catch (error) {
    console.error("[tactics/supabase] saveTacticsBoardWithClient exception", error);
    return { success: false, error: toSaveUserMessage(error) };
  }
}

/**
 * Browser: speichert über Next.js-Proxy `/api/tactics/save` (kein direkter CORS-Call).
 * Server: fällt auf direkten Client zurück.
 */
export async function saveTacticsBoard(
  document: TacticsBoardDocument,
  options: SaveTacticsBoardOptions = {},
): Promise<SaveTacticsBoardResult> {
  if (typeof window === "undefined") {
    if (!supabase) {
      return {
        success: false,
        error:
          getSupabaseConfigError() ??
          "Supabase-URL oder Key fehlt in .env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      };
    }
    return saveTacticsBoardWithClient(supabase, document, options);
  }

  try {
    const response = await fetch("/api/tactics/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document, options }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (payload && typeof payload === "object") {
      const result = payload as SaveTacticsBoardResult;
      if (typeof result.success === "boolean") {
        return {
          success: result.success,
          id: typeof result.id === "string" ? result.id : undefined,
          videoUrl: result.videoUrl,
          error: result.error != null ? safeErrorMessage(result.error) : undefined,
        };
      }
    }

    return {
      success: false,
      error: safeErrorMessage(
        payload,
        `Speichern fehlgeschlagen (HTTP ${response.status}).`,
      ),
    };
  } catch (error) {
    console.error("[tactics/supabase] saveTacticsBoard proxy exception", error);
    return { success: false, error: toSaveUserMessage(error) };
  }
}

/** Lädt ein gespeichertes Taktikboard anhand der Supabase-ID. */
export async function loadTacticsBoard(
  id: string,
): Promise<{ document: TacticsBoardDocument | null; error?: string }> {
  try {
    const { tactic, error } = await loadTactic(id);
    if (error || !tactic) {
      return { document: null, error: error ?? LOAD_FAILURE_MESSAGE };
    }

    if (!tactic.board_data?.keyframes) {
      return { document: null, error: LOAD_FAILURE_MESSAGE };
    }

    return {
      document: boardDataToDocument(tactic.id, tactic.title, tactic.board_data),
    };
  } catch (error) {
    console.error("[tactics/supabase] loadTacticsBoard exception", error);
    return { document: null, error: LOAD_FAILURE_MESSAGE };
  }
}

/**
 * Listet alle Übungen.
 * Kein `.eq('user_id', …)` — die Tabelle `tactics` hat kein user_id;
 * Gäste sehen alle Zeilen, die die anon-SELECT-Policy freigibt.
 */
export async function listTactics(): Promise<{ items: TacticSummary[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      items: [],
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  if (!supabase) {
    return {
      items: [],
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  logSupabase("LIST start", {
    table: TACTICS_TABLE,
    userIdFilter: null,
    note: "Kein user_id-Filter — anon liest alle freigegebenen Zeilen",
  });

  try {
    // Spalten ohne updated_at (Schema in 002_tactics.sql)
    let data: TacticSummary[] | null = null;
    let error: { message?: string; code?: string; details?: string; hint?: string } | null = null;
    try {
      const result = await supabase
        .from(TACTICS_TABLE)
        .select("id, title, created_at, video_url")
        .order("created_at", { ascending: false });
      data = result.data as TacticSummary[] | null;
      error = result.error;
    } catch (fetchError) {
      console.error("[tactics/supabase] LIST fetch exception", fetchError);
      return {
        items: [],
        error: `Übungen konnten nicht geladen werden: ${toSaveUserMessage(fetchError, "Failed to fetch")}`,
      };
    }

    const rowCount = data?.length ?? 0;
    console.log(
      `[tactics/supabase] LIST result: ${rowCount} Zeile(n) aus Tabelle „${TACTICS_TABLE}“`,
      { data, error },
    );

    if (error) {
      const message = formatSupabaseError(error, "Bibliothek konnte nicht geladen werden.");
      console.error("[tactics/supabase] LIST error", error);
      return { items: [], error: `Übungen konnten nicht geladen werden: ${message}` };
    }

    if (rowCount === 0) {
      console.warn(
        "[tactics/supabase] LIST lieferte 0 Zeilen. Wenn Speichern „erfolgreich“ wirkte: RLS SELECT für Role „anon“ prüfen (Migration 002/004).",
      );
    }

    return { items: (data ?? []) as TacticSummary[] };
  } catch (error) {
    console.error("[tactics/supabase] LIST exception", error);
    return {
      items: [],
      error: `Übungen konnten nicht geladen werden: ${toSaveUserMessage(error, "Unbekannter Fehler")}`,
    };
  }
}

export async function deleteTactic(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  if (!supabase) {
    return {
      success: false,
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  logSupabase("DELETE start", { table: TACTICS_TABLE, id });

  try {
    const { error } = await supabase.from(TACTICS_TABLE).delete().eq("id", id);

    logSupabase("DELETE result", { id, error });

    if (error) {
      return { success: false, error: formatSupabaseError(error, "Löschen fehlgeschlagen.") };
    }

    return { success: true };
  } catch (error) {
    console.error("[tactics/supabase] DELETE exception", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Löschen fehlgeschlagen.",
    };
  }
}

export async function loadTactic(id: string): Promise<{ tactic: TacticRecord | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      tactic: null,
      error: LOAD_FAILURE_MESSAGE,
    };
  }

  if (!supabase) {
    return {
      tactic: null,
      error: LOAD_FAILURE_MESSAGE,
    };
  }

  try {
    const { data, error } = await supabase
      .from(TACTICS_TABLE)
      .select("id, title, board_data, video_url, created_at")
      .eq("id", id)
      .single();

    logSupabase("LOAD by id", { id, data: data ? { id: data.id, title: data.title } : null, error });

    if (error) {
      console.error("[tactics/supabase] LOAD error", error);
      return { tactic: null, error: LOAD_FAILURE_MESSAGE };
    }

    return { tactic: data as TacticRecord };
  } catch (error) {
    console.error("[tactics/supabase] LOAD exception", error);
    return { tactic: null, error: LOAD_FAILURE_MESSAGE };
  }
}
