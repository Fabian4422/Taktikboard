"use client";

import type { ReactNode } from "react";
import type { ElementType, FieldRotation, FieldView, ToolMode } from "@/lib/tactics-board/types";
import { CONE_COLOR_OPTIONS } from "@/lib/tactics-board/types";
import { ELEMENT_META } from "@/lib/tactics-board/elementStyles";
import { FIELD_VIEW_LABELS, getEffectiveRotation } from "@/lib/tactics-board/fieldLayout";

interface ToolbarProps {
  toolMode: ToolMode;
  onToolChange: (mode: ToolMode) => void;
  onDeleteSelected: () => void;
  onCopySelected?: () => void;
  onPasteClipboard?: () => void;
  hasSelection: boolean;
  fieldView: FieldView;
  fieldRotation: FieldRotation;
  onFieldViewChange: (view: FieldView) => void;
  onRotateField: () => void;
  onClearBoard: () => void;
  playerScalePercent: number;
  onPlayerScalePercentChange: (percent: number) => void;
  coneColor: string;
  onConeColorChange: (color: string) => void;
}

function MaterialIcon({ type, color }: { type: ElementType; color?: string }) {
  switch (type) {
    case "ball":
      return (
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="#f8fafc" stroke="#1e293b" strokeWidth="1" />
          <polygon points="8,4.8 10,6.2 9.3,8.6 6.7,8.6 6,6.2" fill="#0f172a" />
        </svg>
      );
    case "big-goal":
      return (
        <svg viewBox="0 0 18 14" className="h-4 w-4 shrink-0" aria-hidden>
          <rect x="3" y="2" width="10" height="10" fill="rgba(248,250,252,0.2)" stroke="#e2e8f0" strokeWidth="1.2" />
          <line x1="13" y1="2" x2="13" y2="12" stroke="#f8fafc" strokeWidth="1.6" />
          <line x1="6" y1="2" x2="6" y2="12" stroke="#cbd5e1" strokeWidth="0.5" />
          <line x1="9" y1="2" x2="9" y2="12" stroke="#cbd5e1" strokeWidth="0.5" />
          <line x1="3" y1="5" x2="13" y2="5" stroke="#cbd5e1" strokeWidth="0.5" />
          <line x1="3" y1="8" x2="13" y2="8" stroke="#cbd5e1" strokeWidth="0.5" />
        </svg>
      );
    case "mini-goal":
      return (
        <svg viewBox="0 0 16 12" className="h-4 w-4 shrink-0" aria-hidden>
          <rect x="3" y="2" width="8" height="8" fill="rgba(248,250,252,0.18)" stroke="#e2e8f0" strokeWidth="1.1" />
          <line x1="11" y1="2" x2="11" y2="10" stroke="#f8fafc" strokeWidth="1.4" />
          <line x1="5.5" y1="2" x2="5.5" y2="10" stroke="#cbd5e1" strokeWidth="0.5" />
          <line x1="8" y1="2" x2="8" y2="10" stroke="#cbd5e1" strokeWidth="0.5" />
        </svg>
      );
    case "hurdle":
      return (
        <svg viewBox="0 0 16 12" className="h-4 w-4 shrink-0" aria-hidden>
          <line x1="3" y1="6" x2="13" y2="6" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
          <rect x="2" y="3" width="2.2" height="6" rx="0.5" fill="#facc15" stroke="#1e293b" strokeWidth="0.6" />
          <rect x="11.8" y="3" width="2.2" height="6" rx="0.5" fill="#facc15" stroke="#1e293b" strokeWidth="0.6" />
        </svg>
      );
    case "cone":
      return (
        <svg viewBox="0 0 14 14" className="h-4 w-4 shrink-0" aria-hidden>
          <polygon
            points="7,1.5 12.5,12 1.5,12"
            fill={color ?? "#f97316"}
            stroke="#64748b"
            strokeWidth="1"
          />
        </svg>
      );
    case "pole":
      return (
        <svg viewBox="0 0 14 14" className="h-4 w-4 shrink-0" aria-hidden>
          <circle cx="7" cy="7" r="5.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="4" y1="7" x2="10" y2="7" stroke="#0f172a" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="7" y1="4" x2="7" y2="10" stroke="#0f172a" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "dummy":
      return (
        <svg viewBox="0 0 14 16" className="h-4 w-4 shrink-0" aria-hidden>
          <ellipse cx="7" cy="9" rx="4" ry="5.5" fill={color ?? "#eab308"} stroke="#a16207" strokeWidth="1" />
          <ellipse cx="7" cy="5.5" rx="5.5" ry="2.4" fill={color ?? "#eab308"} stroke="#a16207" strokeWidth="1" />
          <circle cx="7" cy="3.2" r="1.6" fill={color ?? "#eab308"} stroke="#a16207" strokeWidth="0.8" />
        </svg>
      );
    default:
      return null;
  }
}

function ToolButton({
  active,
  label,
  color,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
        active
          ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
          : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700"
      }`}
    >
      {icon}
      {!icon && color && (
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

const GROUPS: { key: "spieler" | "material" | "zeichnen"; title: string }[] = [
  { key: "spieler", title: "Spieler" },
  { key: "material", title: "Material" },
  { key: "zeichnen", title: "Zeichnen" },
];

export function Toolbar({
  toolMode,
  onToolChange,
  onDeleteSelected,
  onCopySelected,
  onPasteClipboard,
  hasSelection,
  fieldView,
  fieldRotation,
  onFieldViewChange,
  onRotateField,
  onClearBoard,
  playerScalePercent,
  onPlayerScalePercentChange,
  coneColor,
  onConeColorChange,
}: ToolbarProps) {
  const elements = Object.entries(ELEMENT_META) as [ElementType, (typeof ELEMENT_META)[ElementType]][];
  const displayedRotation = getEffectiveRotation(fieldView, fieldRotation);
  const orientation =
    displayedRotation === 90 || displayedRotation === 270 ? "Hochformat" : "Querformat";

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-56 lg:shrink-0">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Werkzeug
        </h3>
        <ToolButton
          active={toolMode === "select"}
          label="Auswählen / Verschieben"
          onClick={() => onToolChange("select")}
        />
      </div>

      {GROUPS.map(({ key, title }) => (
        <div key={key}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </h3>
          <div className="flex flex-wrap gap-2 lg:flex-col">
            {elements
              .filter(([, meta]) => meta.group === key)
              .map(([type, meta]) => (
                <ToolButton
                  key={type}
                  active={toolMode === type}
                  label={meta.label}
                  color={meta.group === "spieler" || meta.group === "zeichnen" ? meta.color : undefined}
                  icon={
                    meta.group === "material" ? (
                      <MaterialIcon
                        type={type}
                        color={type === "cone" || type === "dummy" ? coneColor : undefined}
                      />
                    ) : undefined
                  }
                  onClick={() => onToolChange(type)}
                />
              ))}
          </div>
          {key === "spieler" && (
            <label className="mt-3 flex flex-col gap-1">
              <span className="flex justify-between text-xs text-slate-400">
                <span>Spielergröße</span>
                <span>{playerScalePercent} %</span>
              </span>
              <input
                type="range"
                min={25}
                max={200}
                step={5}
                value={playerScalePercent}
                onChange={(e) => onPlayerScalePercentChange(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
              <p className="text-xs text-slate-500">
                Gilt für alle Spieler und neue Platzierungen.
              </p>
            </label>
          )}
          {key === "zeichnen" && (
            <p className="mt-2 text-xs text-slate-500">
              Zwei Klicks auf dem Feld: Start- und Endpunkt setzen.
            </p>
          )}
          {key === "material" && (
            <>
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-400">Hütchen-Farbe</p>
                <div className="flex flex-wrap gap-2">
                  {CONE_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      aria-label={opt.label}
                      onClick={() => {
                        onConeColorChange(opt.value);
                        if (toolMode !== "cone") onToolChange("cone");
                      }}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        coneColor === opt.value
                          ? "border-emerald-400 ring-2 ring-emerald-400/40"
                          : "border-slate-600 hover:border-slate-400"
                      }`}
                      style={{ backgroundColor: opt.value }}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                DFB-Draufsicht: Hütchen, Stangen, Hürden, Dummies und Tore. Angepasste Objekte
                stempeln sich weiter; gleiches Werkzeug erneut = Standard.
              </p>
            </>
          )}
        </div>
      ))}

      {hasSelection && (
        <div className="flex flex-col gap-2">
          {onCopySelected && (
            <button
              type="button"
              onClick={onCopySelected}
              className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
            >
              Kopieren (Ctrl+C)
            </button>
          )}
          {onPasteClipboard && (
            <button
              type="button"
              onClick={onPasteClipboard}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
            >
              Einfügen (Ctrl+V)
            </button>
          )}
          <button
            type="button"
            onClick={onDeleteSelected}
            className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
          >
            Auswahl löschen (Entf)
          </button>
        </div>
      )}

      {!hasSelection && onPasteClipboard && (
        <button
          type="button"
          onClick={onPasteClipboard}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
        >
          Einfügen (Ctrl+V)
        </button>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Spielfeld
        </h3>
        <button
          type="button"
          onClick={onRotateField}
          className="mb-2 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20"
        >
          Spielfeld drehen (90°) · {orientation}
        </button>
        <button
          type="button"
          onClick={onClearBoard}
          className="mb-2 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 hover:border-amber-400 hover:bg-amber-500/20"
        >
          Neues Board / Spielfeld leeren
        </button>
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {(Object.keys(FIELD_VIEW_LABELS) as FieldView[]).map((view) => (
            <ToolButton
              key={view}
              active={fieldView === view}
              label={FIELD_VIEW_LABELS[view]}
              onClick={() => onFieldViewChange(view)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
