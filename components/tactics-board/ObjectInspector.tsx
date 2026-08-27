"use client";

import type { BoardElement } from "@/lib/tactics-board/types";
import {
  CONE_COLOR_OPTIONS,
  DEFAULT_CONE_COLOR,
  elementHasNumber,
  elementSupportsScale,
  getDefaultScale,
  getElementScale,
  isRotatable,
} from "@/lib/tactics-board/types";
import { ELEMENT_META } from "@/lib/tactics-board/elementStyles";

interface ObjectInspectorProps {
  element: BoardElement;
  onUpdate: (patch: Partial<Pick<BoardElement, "x" | "y" | "scale" | "number" | "color">>) => void;
  onClose: () => void;
  onRotate?: (delta: number) => void;
  onDelete?: () => void;
}

export function ObjectInspector({
  element,
  onUpdate,
  onClose,
  onRotate,
  onDelete,
}: ObjectInspectorProps) {
  const meta = ELEMENT_META[element.type];
  const scale = getElementScale(element);
  const baseScale = getDefaultScale(element.type) || 1;
  const scalePercent = Math.round((scale / baseScale) * 100);
  const showNumber = elementHasNumber(element.type);
  const showScale = elementSupportsScale(element.type);
  const showRotate = isRotatable(element.type);
  const showConeColor = element.type === "cone";
  const activeConeColor = element.color ?? DEFAULT_CONE_COLOR;

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return (
    <aside
      className="pointer-events-auto fixed right-4 top-24 z-40 w-72 rounded-2xl border border-slate-600/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md"
      role="dialog"
      aria-label="Objekteigenschaften"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Eigenschaften</p>
          <p className="mt-1 text-sm font-medium text-white">{meta.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 text-lg leading-none text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Schließen"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">X</span>
          <input
            type="number"
            step={1}
            value={Math.round(element.x)}
            onChange={(e) => onUpdate({ x: parseNumber(e.target.value, element.x) })}
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Y</span>
          <input
            type="number"
            step={1}
            value={Math.round(element.y)}
            onChange={(e) => onUpdate({ y: parseNumber(e.target.value, element.y) })}
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      {showScale && (
        <label className="mt-3 flex flex-col gap-1">
          <span className="flex justify-between text-xs text-slate-400">
            <span>Größe</span>
            <span>{scalePercent} %</span>
          </span>
          <input
            type="range"
            min={25}
            max={200}
            step={5}
            value={scalePercent}
            onChange={(e) =>
              onUpdate({
                scale: (parseNumber(e.target.value, scalePercent) / 100) * baseScale,
              })
            }
            className="w-full accent-sky-400"
          />
        </label>
      )}

      {showNumber && (
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs text-slate-400">Nummer</span>
          <input
            type="number"
            min={0}
            max={99}
            step={1}
            value={element.number ?? ""}
            placeholder="—"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onUpdate({ number: undefined });
                return;
              }
              onUpdate({ number: Math.max(0, Math.min(99, parseNumber(raw, 0))) });
            }}
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
      )}

      {showConeColor && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-400">Hütchen-Farbe</p>
          <div className="flex flex-wrap gap-2">
            {CONE_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.label}
                aria-label={opt.label}
                onClick={() => onUpdate({ color: opt.value })}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  activeConeColor === opt.value
                    ? "border-emerald-400 ring-2 ring-emerald-400/40"
                    : "border-slate-600 hover:border-slate-400"
                }`}
                style={{ backgroundColor: opt.value }}
              />
            ))}
          </div>
        </div>
      )}

      {showRotate && onRotate && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onRotate(-45)}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            ↺ 45°
          </button>
          <button
            type="button"
            onClick={() => onRotate(45)}
            className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            ↻ 45°
          </button>
        </div>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 w-full rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20"
        >
          Objekt löschen
        </button>
      )}
    </aside>
  );
}
