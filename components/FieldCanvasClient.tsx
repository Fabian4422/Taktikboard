"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { FieldCanvas as FieldCanvasImpl } from "./tactics-board/FieldCanvas";

type FieldCanvasProps = ComponentProps<typeof FieldCanvasImpl>;

/**
 * Statischer Import von FieldCanvas (kein next/dynamic / kein await import).
 * Mount-Gate vermeidet Konva-SSR-Zugriffe auf window — ohne separaten Chunk.
 */
export function FieldCanvasClient(props: FieldCanvasProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-700 bg-emerald-900/30">
        <span className="text-slate-400">Spielfeld wird geladen…</span>
      </div>
    );
  }

  return <FieldCanvasImpl {...props} />;
}
