import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TacticsBoardDocument } from "@/lib/tactics-board/types";
import {
  TACTICS_TABLE,
  saveTacticsBoardWithClient,
  safeErrorMessage,
  type SaveTacticsBoardOptions,
} from "@/lib/tactics-board/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeEnv(raw: string | undefined): string {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
}

/**
 * Proxy-Speichern: Client → Next.js → Supabase (umgeht Tablet-CORS/Preflight).
 * Tabelle: public.tactics (Spalten: id, title, board_data JSONB, video_url, created_at)
 * Body: { document: TacticsBoardDocument, options?: SaveTacticsBoardOptions }
 */
export async function POST(request: Request) {
  try {
    const url = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
    const key = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!url || !key) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Supabase-URL oder Key fehlt in .env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
          table: TACTICS_TABLE,
        },
        { status: 500 },
      );
    }
    if (!/^https:\/\//i.test(url)) {
      return NextResponse.json(
        {
          success: false,
          error: `Supabase-URL muss mit https:// beginnen (aktuell: "${url.slice(0, 64)}").`,
          table: TACTICS_TABLE,
        },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Ungültiger JSON-Body.", table: TACTICS_TABLE },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Body muss ein Objekt mit document sein.",
          table: TACTICS_TABLE,
        },
        { status: 400 },
      );
    }

    const { document, options } = body as {
      document?: TacticsBoardDocument;
      options?: SaveTacticsBoardOptions;
    };

    if (!document || typeof document !== "object" || !Array.isArray(document.keyframes)) {
      return NextResponse.json(
        {
          success: false,
          error: "document.keyframes fehlt oder ist ungültig.",
          table: TACTICS_TABLE,
        },
        { status: 400 },
      );
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await saveTacticsBoardWithClient(supabase, document, options ?? {});

    if (!result.success) {
      const errorText = safeErrorMessage(
        result.error,
        "Speichern fehlgeschlagen (keine error-Message aus saveTacticsBoardWithClient).",
      );
      console.error("Supabase Error Details:", {
        table: TACTICS_TABLE,
        error: errorText,
        result,
        expectedColumns: ["id", "title", "board_data", "video_url", "created_at"],
      });
      return NextResponse.json(
        {
          success: false,
          error: errorText,
          table: TACTICS_TABLE,
          expectedColumns: ["id", "title", "board_data", "video_url", "created_at"],
        },
        { status: 500 },
      );
    }

    if (!result.id) {
      const errorText =
        "Speichern meldete Erfolg, aber keine ID (oft SELECT-RLS nach INSERT).";
      console.error("Supabase Error Details:", { table: TACTICS_TABLE, result });
      return NextResponse.json(
        { success: false, error: errorText, table: TACTICS_TABLE },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, id: result.id, videoUrl: result.videoUrl ?? null },
      { status: 200 },
    );
  } catch (error) {
    const errorText = safeErrorMessage(error, "Unbekannter Server-Fehler beim Speichern.");
    console.error("[api/tactics/save] exception", error);
    console.error("Supabase Error Details:", error);
    return NextResponse.json(
      { success: false, error: errorText, table: TACTICS_TABLE },
      { status: 500 },
    );
  }
}
