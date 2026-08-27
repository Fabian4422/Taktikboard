"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, listTactics, type TacticSummary } from "@/lib/tactics-board/supabase";

export function SavedTacticsList() {
  const [items, setItems] = useState<TacticSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await listTactics();
      if (cancelled) return;
      setItems(result.items);
      setError(result.error ?? null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Gespeicherte Übungen werden geladen…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="max-w-md text-center text-sm text-slate-500">
        Noch keine Übungen gespeichert. Erstelle ein Board und klicke auf „In Supabase speichern“.
      </p>
    );
  }

  return (
    <section className="w-full max-w-lg">
      <h2 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
        Gespeicherte Übungen
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/admin/tactics-board?exerciseId=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.title)}`}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-800"
            >
              <span className="truncate font-medium">{item.title}</span>
              <span className="ml-3 shrink-0 text-xs text-slate-500">
                {new Date(item.created_at).toLocaleDateString("de-DE")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
