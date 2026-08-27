"use client";

import type { ReactNode } from "react";
import type { ElementType, FieldView, ToolMode } from "@/lib/tactics-board/types";
import { CONE_COLOR_OPTIONS } from "@/lib/tactics-board/types";
import { ELEMENT_META } from "@/lib/tactics-board/elementStyles";
import { FIELD_VIEW_LABELS } from "@/lib/tactics-board/fieldLayout";

interface ToolbarProps {
  toolMode: ToolMode;
  onToolChange: (mode: ToolMode) => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  fieldView: FieldView;
  onFieldViewChange: (view: FieldView) => void;
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
          <polygon points="8,4.6 10.2,6.2 9.4,8.8 6.6,8.8 5.8,6.2" fill="#0f172a" />
        </svg>
      );
    case "big-goal":
      return (
        <svg viewBox="0 0 18 14" className="h-4 w-4 shrink-0" aria-hidden>
          <polygon points="4,3 4,11 15,11 15,3" fill="rgba(248,250,252,0.25)" stroke="#e2e8f0" strokeWidth="1.2" />
          <line x1="7" y1="3" x2="7" y2="11" stroke="#cbd5e1" strokeWidth="0.6" />
          <line x1="10.5" y1="3" x2="10.5" y2="11" stroke="#cbd5e1" strokeWidth="0.6" />
          <line x1="13.5" y1="3" x2="13.5" y2="11" stroke="#cbd5e1" strokeWidth="0.6" />
        </svg>
      );
    case "mini-goal":
      return (
        <svg viewBox="0 0 16 12" className="h-4 w-4 shrink-0" aria-hidden>
          <polygon points="4,3 4,9 14,9 14,3" fill="rgba(248,250,252,0.2)" stroke="#e2e8f0" strokeWidth="1.1" />
          <line x1="7.5" y1="3" x2="7.5" y2="9" stroke="#cbd5e1" strokeWidth="0.6" />
          <line x1="11" y1="3" x2="11" y2="9" stroke="#cbd5e1" strokeWidth="0.6" />
        </svg>
      );
    case "hurdle":
      return (
        <svg viewBox="0 0 16 14" className="h-4 w-4 shrink-0" aria-hidden>
          <rect x="2" y="3" width="2" height="9" fill="#facc15" />
          <rect x="12" y="3" width="2" height="9" fill="#facc15" />
          <rect x="2" y="5" width="2" height="2" fill="#111827" />
          <rect x="12" y="5" width="2" height="2" fill="#111827" />
          <path d="M3 4 Q8 1 13 4" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "cone":
      return (
        <svg viewBox="0 0 14 14" className="h-4 w-4 shrink-0" aria-hidden>
          <polygon
            points="7,1 13,13 1,13"
            fill={color ?? "#f97316"}
            stroke="#64748b"
            strokeWidth="1"
          />
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
  hasSelection,
  fieldView,
  onFieldViewChange,
  playerScalePercent,
  onPlayerScalePercentChange,
  coneColor,
  onConeColorChange,
}: ToolbarProps) {
  const elements = Object.entries(ELEMENT_META) as [ElementType, (typeof ELEMENT_META)[ElementType]][];

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-56 lg:shrink-0">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Spielfeld
        </h3>
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
                      <MaterialIcon type={type} color={type === "cone" ? coneColor : undefined} />
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
                        onToolChange("cone");
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
                Tore, Hürden und Hütchen sind drehbar (Anfasser oder Taste R).
              </p>
            </>
          )}
        </div>
      ))}

      {hasSelection && (
        <button
          type="button"
          onClick={onDeleteSelected}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
        >
          Auswahl löschen (Entf)
        </button>
      )}
    </aside>
  );
}
