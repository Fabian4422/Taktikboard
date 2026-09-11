"use client";

import { useEffect, useState } from "react";
import type { BoardElement, TextBoxBackgroundStyle, TextBoxFontFamily } from "@/lib/tactics-board/types";
import {
  CONE_COLOR_OPTIONS,
  DEFAULT_CONE_COLOR,
  DEFAULT_KEYFRAME_DURATION_S,
  DEFAULT_TEXT_BOX_BORDER_RADIUS,
  DEFAULT_TEXT_BOX_FONT_SIZE,
  DEFAULT_TEXT_BOX_TEXT,
  elementHasNumber,
  elementSupportsScale,
  getDefaultScale,
  getElementScale,
  getTextBoxBgColor,
  getTextBoxBgStyle,
  getTextBoxBorderRadius,
  getTextBoxColor,
  getTextBoxDisplayDuration,
  getTextBoxFontFamily,
  getTextBoxFontSize,
  isRotatable,
  isTextBoxType,
  MAX_KEYFRAME_DURATION_S,
  MIN_KEYFRAME_DURATION_S,
  TEXT_BOX_BG_STYLE_OPTIONS,
  TEXT_BOX_FONT_OPTIONS,
  TEXT_COLOR_OPTIONS,
  clampKeyframeDuration,
} from "@/lib/tactics-board/types";
import { ELEMENT_META } from "@/lib/tactics-board/elementStyles";

type ElementPatch = Partial<
  Pick<
    BoardElement,
    | "x"
    | "y"
    | "scale"
    | "number"
    | "color"
    | "text"
    | "fontSize"
    | "fontFamily"
    | "bgColor"
    | "bgStyle"
    | "borderRadius"
    | "width"
    | "duration"
  >
>;

interface ObjectInspectorProps {
  element: BoardElement;
  onUpdate: (patch: ElementPatch) => void;
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
  const showScale = elementSupportsScale(element.type) && !isTextBoxType(element.type);
  const showRotate = isRotatable(element.type);
  const showConeColor = element.type === "cone" || element.type === "dummy";
  const showTextBox = isTextBoxType(element.type);
  const activeConeColor = element.color ?? DEFAULT_CONE_COLOR;

  const [xDraft, setXDraft] = useState(String(Math.round(element.x)));
  const [yDraft, setYDraft] = useState(String(Math.round(element.y)));
  const [textDraft, setTextDraft] = useState(element.text ?? DEFAULT_TEXT_BOX_TEXT);

  useEffect(() => {
    setXDraft(String(Math.round(element.x)));
    setYDraft(String(Math.round(element.y)));
  }, [element.id, element.x, element.y]);

  useEffect(() => {
    setTextDraft(element.text ?? DEFAULT_TEXT_BOX_TEXT);
  }, [element.id, element.text]);

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const commitAxis = (axis: "x" | "y", raw: string) => {
    if (raw.trim() === "") {
      onUpdate({ [axis]: 0 });
      if (axis === "x") setXDraft("0");
      else setYDraft("0");
      return;
    }
    const next = parseNumber(raw, axis === "x" ? element.x : element.y);
    onUpdate({ [axis]: next });
    if (axis === "x") setXDraft(String(Math.round(next)));
    else setYDraft(String(Math.round(next)));
  };

  const fontSize = getTextBoxFontSize(element);
  const fontFamily = getTextBoxFontFamily(element);
  const textColor = getTextBoxColor(element);
  const bgColor = getTextBoxBgColor(element);
  const bgStyle = getTextBoxBgStyle(element);
  const borderRadius = getTextBoxBorderRadius(element);
  const displayDuration = getTextBoxDisplayDuration(element);

  return (
    <aside
      className="pointer-events-auto fixed right-4 top-24 z-40 max-h-[calc(100vh-7rem)] w-72 overflow-y-auto rounded-2xl border border-slate-600/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md"
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
            type="text"
            inputMode="decimal"
            value={xDraft}
            onChange={(e) => setXDraft(e.target.value)}
            onBlur={() => commitAxis("x", xDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Y</span>
          <input
            type="text"
            inputMode="decimal"
            value={yDraft}
            onChange={(e) => setYDraft(e.target.value)}
            onBlur={() => commitAxis("y", yDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      {showTextBox && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Textinhalt</span>
            <textarea
              rows={3}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={() => onUpdate({ text: textDraft })}
              className="resize-y rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between text-xs text-slate-400">
              <span>Schriftgröße</span>
              <span>{fontSize} px</span>
            </span>
            <input
              type="range"
              min={10}
              max={48}
              step={1}
              value={fontSize}
              onChange={(e) =>
                onUpdate({
                  fontSize: Math.max(10, Math.min(48, parseNumber(e.target.value, DEFAULT_TEXT_BOX_FONT_SIZE))),
                })
              }
              className="w-full accent-sky-400"
            />
            <input
              type="number"
              min={10}
              max={48}
              value={fontSize}
              onChange={(e) =>
                onUpdate({
                  fontSize: Math.max(10, Math.min(48, parseNumber(e.target.value, fontSize))),
                })
              }
              className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Schriftart</span>
            <select
              value={fontFamily}
              onChange={(e) => onUpdate({ fontFamily: e.target.value as TextBoxFontFamily })}
              className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
            >
              {TEXT_BOX_FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="mb-2 text-xs text-slate-400">Textfarbe</p>
            <div className="flex flex-wrap gap-2">
              {TEXT_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.label}
                  aria-label={opt.label}
                  onClick={() => onUpdate({ color: opt.value })}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    textColor === opt.value
                      ? "border-emerald-400 ring-2 ring-emerald-400/40"
                      : "border-slate-600 hover:border-slate-400"
                  }`}
                  style={{ backgroundColor: opt.value }}
                />
              ))}
            </div>
            <input
              type="color"
              value={textColor}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="mt-2 h-8 w-full cursor-pointer rounded border border-slate-600 bg-slate-950"
              title="Eigene Textfarbe"
            />
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-400">Hintergrund</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {TEXT_BOX_BG_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate({ bgStyle: opt.value as TextBoxBackgroundStyle })}
                  className={`rounded-md border px-2 py-1 text-[11px] transition ${
                    bgStyle === opt.value
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                      : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {bgStyle !== "none" && (
              <input
                type="color"
                value={bgColor}
                onChange={(e) => onUpdate({ bgColor: e.target.value })}
                className="h-8 w-full cursor-pointer rounded border border-slate-600 bg-slate-950"
                title="Hintergrundfarbe"
              />
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between text-xs text-slate-400">
              <span>Anzeigedauer</span>
              <span>{displayDuration.toFixed(1)}s</span>
            </span>
            <input
              type="range"
              min={MIN_KEYFRAME_DURATION_S}
              max={MAX_KEYFRAME_DURATION_S}
              step={0.1}
              value={displayDuration}
              onChange={(e) =>
                onUpdate({
                  duration: clampKeyframeDuration(parseNumber(e.target.value, DEFAULT_KEYFRAME_DURATION_S)),
                })
              }
              className="w-full accent-sky-400"
            />
            <input
              type="number"
              min={MIN_KEYFRAME_DURATION_S}
              max={MAX_KEYFRAME_DURATION_S}
              step={0.1}
              value={Number(displayDuration.toFixed(1))}
              onChange={(e) => {
                const raw = Number.parseFloat(e.target.value);
                if (!Number.isFinite(raw)) return;
                onUpdate({ duration: clampKeyframeDuration(raw) });
              }}
              className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
            />
            <p className="text-[11px] text-slate-500">
              Steuert die Standzeit dieses Schritts in Vorschau und Export (bei Standbild ohne Bewegung).
            </p>
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between text-xs text-slate-400">
              <span>Abrundung</span>
              <span>{borderRadius} px</span>
            </span>
            <input
              type="range"
              min={0}
              max={32}
              step={1}
              value={borderRadius}
              onChange={(e) =>
                onUpdate({
                  borderRadius: Math.max(
                    0,
                    Math.min(32, parseNumber(e.target.value, DEFAULT_TEXT_BOX_BORDER_RADIUS)),
                  ),
                })
              }
              className="w-full accent-sky-400"
            />
          </label>
        </div>
      )}

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
          <p className="mb-2 text-xs text-slate-400">Materialfarbe</p>
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
