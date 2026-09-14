import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TacticsBoardDocument } from "@/lib/tactics-board/types";
import {
  saveTacticsBoardWithClient,
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

function safeMessage(err: unknown): string {
  if (typeof err === "string") return err.trim() || "Unbekannter Fehler";
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unbekannter Fehler";
  }
}

/**
 * Proxy-Speichern: Client → Next.js → Supabase (umgeht Tablet-CORS/Preflight).
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
          error: "Supabase-URL oder Key fehlt in .env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
        },
        { status: 500 },
      );
    }
    if (!/^https:\/\//i.test(url)) {
      return NextResponse.json(
        {
          success: false,
          error: `Supabase-URL muss mit https:// beginnen (aktuell: "${url.slice(0, 64)}").`,
        },
        { status: 500 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Ungültiger JSON-Body." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Body muss ein Objekt mit document sein." },
        { status: 400 },
      );
    }

    const { document, options } = body as {
      document?: TacticsBoardDocument;
      options?: SaveTacticsBoardOptions;
    };

    if (!document || typeof document !== "object" || !Array.isArray(document.keyframes)) {
      return NextResponse.json(
        { success: false, error: "document.keyframes fehlt oder ist ungültig." },
        { status: 400 },
      );
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await saveTacticsBoardWithClient(supabase, document, options ?? {});

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("[api/tactics/save] exception", error);
    return NextResponse.json(
      { success: false, error: safeMessage(error) },
      { status: 500 },
    );
  }
}
