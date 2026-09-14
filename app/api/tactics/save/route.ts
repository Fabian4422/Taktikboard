import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TacticsBoardDocument } from "@/lib/tactics-board/types";
import {
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
 * Proxy-Speichern: Client → Next.js → public.tactics (nie `exercises`).
 * Spalten: id, title, board_data JSONB, video_url, created_at
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
          table: "tactics",
        },
        { status: 500 },
      );
    }
    if (!/^https:\/\//i.test(url)) {
      return NextResponse.json(
        {
          success: false,
          error: `Supabase-URL muss mit https:// beginnen (aktuell: "${url.slice(0, 64)}").`,
          table: "tactics",
        },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Ungültiger JSON-Body.", table: "tactics" },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Body muss ein Objekt mit document sein.",
          table: "tactics",
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
          table: "tactics",
        },
        { status: 400 },
      );
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Explizit public.tactics — TACTICS_TABLE ist "tactics"
    const result = await saveTacticsBoardWithClient(supabase, document, options ?? {});

    if (!result.success || result.error) {
      const errorText = safeErrorMessage(
        result.error,
        "Speichern in public.tactics fehlgeschlagen.",
      );
      console.error("Supabase Error Details:", {
        table: "tactics",
        error: errorText,
        result,
      });
      return NextResponse.json(
        {
          success: false,
          error: errorText,
          table: "tactics",
        },
        { status: 500 },
      );
    }

    // success ohne error → 100% erfolgreich (ID optional)
    return NextResponse.json(
      {
        success: true,
        id: result.id ?? null,
        videoUrl: result.videoUrl ?? null,
        table: "tactics",
      },
      { status: 200 },
    );
  } catch (error) {
    const errorText = safeErrorMessage(error, "Unbekannter Server-Fehler beim Speichern.");
    console.error("[api/tactics/save] exception", error);
    console.error("Supabase Error Details:", error);
    return NextResponse.json(
      { success: false, error: errorText, table: "tactics" },
      { status: 500 },
    );
  }
}
