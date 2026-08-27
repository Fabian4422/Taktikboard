"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteTactic,
  isSupabaseConfigured,
  listTactics,
  type TacticSummary,
} from "@/lib/tactics-board/supabase";

interface ExerciseLibraryModalProps {
  open: boolean;
  currentId?: string | null;
  onClose: () => void;
  onLoad: (id: string, title: string) => void;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ExerciseLibraryModal({
  open,
  currentId,
  onClose,
  onLoad,
}: ExerciseLibraryModalProps) {
  const [items, setItems] = useState<TacticSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError("Supabase ist nicht konfiguriert.");
      setEmptyHint(null);
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    setEmptyHint(null);
    const { items: next, error: listError } = await listTactics();
    console.log(
      `[ExerciseLibrary] ${next.length} Zeile(n) aus der Datenbank geladen` +
        (listError ? ` (Fehler: ${listError})` : ""),
    );
    setItems(next);
    if (listError) {
      setError(listError);
    } else if (next.length === 0) {
      setEmptyHint(
        "0 Zeilen von Supabase. Wenn Speichern „ok“ wirkte, fehlen oft RLS-Policies (SELECT/INSERT für Role anon) auf Tabelle „tactics“. SQL: supabase/migrations/002_tactics.sql und 004_tactics_anon_rls.sql im Supabase SQL Editor ausführen.",
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleDelete = async (item: TacticSummary) => {
    const ok = window.confirm(
      `Übung „${item.title}“ wirklich löschen? Das kann nicht rückgängig gemacht werden.`,
    );
    if (!ok) return;

    setBusyId(item.id);
    const result = await deleteTactic(item.id);
    setBusyId(null);

    if (!result.success) {
      setError(result.error ?? "Löschen fehlgeschlagen.");
      return;
    }

    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Meine gespeicherten Übungen"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Meine gespeicherten Übungen</h2>
            <p className="mt-1 text-sm text-slate-400">
              Gespeicherte Boards aus Supabase laden oder löschen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 text-lg text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && (
            <p className="py-10 text-center text-sm text-slate-400">Bibliothek wird geladen…</p>
          )}

          {!loading && error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && emptyHint && (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {emptyHint}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              Noch keine Übungen gespeichert.
            </p>
          )}

          {!loading && items.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const modified = item.updated_at || item.created_at;
                const isCurrent = currentId === item.id;
                return (
                  <article
                    key={item.id}
                    className={`flex flex-col rounded-xl border p-4 ${
                      isCurrent
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-slate-700 bg-slate-950/70"
                    }`}
                  >
                    <h3 className="truncate text-sm font-semibold text-white" title={item.title}>
                      {item.title || "Ohne Titel"}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.updated_at && item.updated_at !== item.created_at
                        ? `Geändert: ${formatDate(modified)}`
                        : `Erstellt: ${formatDate(item.created_at)}`}
                    </p>
                    {isCurrent && (
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                        Aktuell geöffnet
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => onLoad(item.id, item.title)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Laden
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleDelete(item)}
                        className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-700 px-5 py-3">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            Aktualisieren
          </button>
        </div>
      </div>
    </div>
  );
}
