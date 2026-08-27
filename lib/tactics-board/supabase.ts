import type { FieldRotation, FieldView, Keyframe, TacticsBoardDocument } from "./types";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { createId } from "@/lib/uuid";

export { isSupabaseConfigured };

/** Aktuelle Speichertabelle (nicht `tactics_boards` / `boards`). */
export const TACTICS_TABLE = "tactics";
export const TACTICS_VIDEO_BUCKET = "tactics-videos";

export interface BoardData {
  keyframes: Keyframe[];
  fieldWidth: number;
  fieldHeight: number;
  fieldView?: FieldView;
  fieldRotation?: FieldRotation;
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

function documentToBoardData(document: TacticsBoardDocument): BoardData {
  return {
    keyframes: document.keyframes,
    fieldWidth: document.fieldWidth,
    fieldHeight: document.fieldHeight,
    fieldView: document.fieldView,
    fieldRotation: document.fieldRotation,
  };
}

function boardDataToDocument(
  id: string,
  title: string,
  boardData: BoardData,
): TacticsBoardDocument {
  return {
    id,
    name: title,
    keyframes: boardData.keyframes ?? [],
    fieldWidth: boardData.fieldWidth ?? 1050,
    fieldHeight: boardData.fieldHeight ?? 680,
    fieldView: boardData.fieldView,
    fieldRotation: boardData.fieldRotation,
  };
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

/** Formatiert Supabase/PostgREST-Fehler inkl. Code/Hint für UI + Konsole. */
function formatSupabaseError(
  error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  const parts = [
    error.message || fallback,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function logSupabase(label: string, payload: Record<string, unknown>) {
  console.log(`[tactics/supabase] ${label}`, payload);
}

async function uploadTacticVideo(
  title: string,
  video: TacticExportFile,
): Promise<{ publicUrl: string }> {
  const supabase = getSupabaseClient();
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
 * Speichert eine Übung in der Tabelle `tactics`.
 * Kein user_id-Filter: Gäste speichern anonym über den anon-Key (RLS muss SELECT+INSERT erlauben).
 */
export async function saveTactic(params: {
  title: string;
  boardData: BoardData;
  video?: TacticExportFile | null;
}): Promise<SaveTacticResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  const title = params.title.trim();
  if (!title) {
    return { success: false, error: "Bitte einen Titel für die Übung eingeben." };
  }

  try {
    let videoUrl: string | null = null;
    if (params.video?.blob && params.video.blob.size > 0) {
      const uploaded = await uploadTacticVideo(title, params.video);
      videoUrl = uploaded.publicUrl;
    }

    const payload = {
      title,
      board_data: params.boardData,
      video_url: videoUrl,
    };

    logSupabase("INSERT start", {
      table: TACTICS_TABLE,
      title,
      keyframeCount: params.boardData.keyframes?.length ?? 0,
      hasVideo: Boolean(videoUrl),
      // Kein user_id — anon-Gastzugriff über RLS
      userIdFilter: null,
    });

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from(TACTICS_TABLE).insert(payload).select("id").single();

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

    // Sofort prüfen, ob die Zeile für den anon-Key auch lesbar ist
    const verify = await supabase
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

    return { success: true, id: data.id, videoUrl };
  } catch (error) {
    console.error("[tactics/supabase] INSERT exception", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Speichern in Supabase fehlgeschlagen.",
    };
  }
}

/** Aktualisiert eine bestehende Übung in der Tabelle `tactics`. */
export async function updateTactic(params: {
  id: string;
  title: string;
  boardData: BoardData;
  video?: TacticExportFile | null;
}): Promise<SaveTacticResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  const title = params.title.trim();
  if (!title) {
    return { success: false, error: "Bitte einen Titel für die Übung eingeben." };
  }

  try {
    let videoUrl: string | null | undefined;
    if (params.video?.blob && params.video.blob.size > 0) {
      const uploaded = await uploadTacticVideo(title, params.video);
      videoUrl = uploaded.publicUrl;
    }

    const payload: Record<string, unknown> = {
      title,
      board_data: params.boardData,
    };
    if (videoUrl !== undefined) {
      payload.video_url = videoUrl;
    }

    logSupabase("UPDATE start", { table: TACTICS_TABLE, id: params.id, title });

    const { data, error } = await getSupabaseClient()
      .from(TACTICS_TABLE)
      .update(payload)
      .eq("id", params.id)
      .select("id, video_url")
      .single();

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
      error: error instanceof Error ? error.message : "Aktualisieren in Supabase fehlgeschlagen.",
    };
  }
}

/**
 * Speichert oder aktualisiert ein Taktikboard-Dokument in Supabase.
 * Existiert bereits eine ID (im Dokument oder als exerciseId), wird aktualisiert.
 */
export async function saveTacticsBoard(
  document: TacticsBoardDocument,
  options: SaveTacticsBoardOptions = {},
): Promise<SaveTacticsBoardResult> {
  const title = (options.name ?? document.name).trim();
  const boardData = documentToBoardData(document);
  const existingId = document.id ?? options.exerciseId;

  logSupabase("saveTacticsBoard", {
    title,
    existingId: existingId ?? null,
    mode: existingId ? "update" : "insert",
    table: TACTICS_TABLE,
  });

  if (existingId) {
    return updateTactic({ id: existingId, title, boardData });
  }

  return saveTactic({ title, boardData });
}

/** Lädt ein gespeichertes Taktikboard anhand der Supabase-ID. */
export async function loadTacticsBoard(
  id: string,
): Promise<{ document: TacticsBoardDocument | null; error?: string }> {
  const { tactic, error } = await loadTactic(id);
  if (error || !tactic) {
    return { document: null, error: error ?? "Übung nicht gefunden." };
  }

  if (!tactic.board_data?.keyframes) {
    return { document: null, error: "Gespeicherte Board-Daten sind ungültig oder leer." };
  }

  return {
    document: boardDataToDocument(tactic.id, tactic.title, tactic.board_data),
  };
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

  logSupabase("LIST start", {
    table: TACTICS_TABLE,
    userIdFilter: null,
    note: "Kein user_id-Filter — anon liest alle freigegebenen Zeilen",
  });

  // Spalten ohne updated_at (Schema in 002_tactics.sql)
  const { data, error } = await getSupabaseClient()
    .from(TACTICS_TABLE)
    .select("id, title, created_at, video_url")
    .order("created_at", { ascending: false });

  const rowCount = data?.length ?? 0;
  console.log(
    `[tactics/supabase] LIST result: ${rowCount} Zeile(n) aus Tabelle „${TACTICS_TABLE}“`,
    { data, error },
  );

  if (error) {
    const message = formatSupabaseError(error, "Bibliothek konnte nicht geladen werden.");
    console.error("[tactics/supabase] LIST error", error);
    return { items: [], error: message };
  }

  if (rowCount === 0) {
    console.warn(
      "[tactics/supabase] LIST lieferte 0 Zeilen. Wenn Speichern „erfolgreich“ wirkte: RLS SELECT für Role „anon“ prüfen (Migration 002/004).",
    );
  }

  return { items: (data ?? []) as TacticSummary[] };
}

export async function deleteTactic(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  logSupabase("DELETE start", { table: TACTICS_TABLE, id });

  const { error } = await getSupabaseClient().from(TACTICS_TABLE).delete().eq("id", id);

  logSupabase("DELETE result", { id, error });

  if (error) {
    return { success: false, error: formatSupabaseError(error, "Löschen fehlgeschlagen.") };
  }

  return { success: true };
}

export async function loadTactic(id: string): Promise<{ tactic: TacticRecord | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      tactic: null,
      error: "Supabase ist nicht konfiguriert (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen).",
    };
  }

  const { data, error } = await getSupabaseClient()
    .from(TACTICS_TABLE)
    .select("id, title, board_data, video_url, created_at")
    .eq("id", id)
    .single();

  logSupabase("LOAD by id", { id, data: data ? { id: data.id, title: data.title } : null, error });

  if (error) {
    return { tactic: null, error: formatSupabaseError(error, "Übung nicht gefunden.") };
  }

  return { tactic: data as TacticRecord };
}
