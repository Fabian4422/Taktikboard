import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeEnv(raw: string | undefined): string {
  if (raw == null) return "";
  return raw
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
}

/**
 * Täglicher Keep-Alive gegen Supabase Free-Tier-Pause.
 * Vercel Cron: GET /api/cron/keep-alive (siehe vercel.json).
 * Auth: Authorization: Bearer <CRON_SECRET> (wenn CRON_SECRET gesetzt).
 */
export async function GET(request: Request) {
  const cronSecret = sanitizeEnv(process.env.CRON_SECRET);
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }
  }

  const url = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
  const key = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !key || !/^https:\/\//i.test(url)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Supabase-URL oder Key fehlt in .env",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Minimale Leseanfrage auf die aktive Speichertabelle
    const { error } = await supabase.from("tactics").select("id").limit(1);

    if (error) {
      console.error("[cron/keep-alive] Supabase error", error);
      return NextResponse.json(
        {
          status: "error",
          message: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
          timestamp: new Date().toISOString(),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/keep-alive] exception", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
