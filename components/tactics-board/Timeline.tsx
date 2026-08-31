"use client";

import type { KeyframeSpeed, PlaybackRate } from "@/lib/tactics-board/types";
import { KEYFRAME_SPEED_LABELS, PLAYBACK_RATE_LABELS, PLAYBACK_RATES } from "@/lib/tactics-board/types";
import { PlaybackBar } from "./PlaybackBar";

interface TimelineProps {
  steps: { id: string; label: string; speed?: KeyframeSpeed }[];
  currentIndex: number;
  isPlaying: boolean;
  isPaused?: boolean;
  isExporting?: boolean;
  exportLabel?: string | null;
  exportPercent?: number;
  playbackProgress: number;
  playbackRate: PlaybackRate;
  onSelectStep: (index: number) => void;
  onAddStep: () => void;
  onDeleteStep: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange?: (index: number, speed: KeyframeSpeed) => void;
  onSetAllSpeeds?: (speed: KeyframeSpeed) => void;
  onPlaybackRateChange: (rate: PlaybackRate) => void;
  onExportVideo?: () => void;
  onExportGif?: () => void;
}

export function Timeline({
  steps,
  currentIndex,
  isPlaying,
  isPaused,
  isExporting = false,
  exportLabel,
  exportPercent = 0,
  playbackProgress,
  playbackRate,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  onSetAllSpeeds,
  onPlaybackRateChange,
  onExportVideo,
  onExportGif,
}: TimelineProps) {
  const canPlay = steps.length >= 2;
  const busy = isPlaying || isExporting;
  const speeds = Object.keys(KEYFRAME_SPEED_LABELS) as KeyframeSpeed[];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-300">Timeline</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Gesamt-Tempo
            </span>
            <div className="flex rounded-lg border border-slate-600 bg-slate-950 p-0.5">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onPlaybackRateChange(rate)}
                  disabled={busy}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    playbackRate === rate
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
                  }`}
                >
                  {PLAYBACK_RATE_LABELS[rate]}
                </button>
              ))}
            </div>
          </div>
          <PlaybackBar
            isPlaying={isPlaying}
            isPaused={isPaused}
            canPlay={canPlay && !isExporting}
            playbackProgress={playbackProgress}
            onPlay={onPlay}
            onPause={onPause}
            onStop={onStop}
          />
        </div>
      </div>

      {onSetAllSpeeds && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Alle Schritte setzen auf:</span>
          <div className="flex rounded-lg border border-slate-600 bg-slate-950 p-0.5">
            {speeds.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onSetAllSpeeds(speed)}
                disabled={busy || steps.length === 0}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {KEYFRAME_SPEED_LABELS[speed]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const isActive = !busy && index === currentIndex;
          return (
            <div key={step.id} className="group relative min-w-[108px]">
              <button
                type="button"
                onClick={() => !busy && onSelectStep(index)}
                disabled={busy}
                className={`w-full rounded-lg border px-4 py-2 text-sm transition ${
                  isActive
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                    : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 disabled:opacity-60"
                }`}
              >
                {step.label}
              </button>
              {steps.length > 1 && !busy && (
                <button
                  type="button"
                  onClick={() => onDeleteStep(index)}
                  className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white group-hover:flex"
                  title="Schritt löschen"
                >
                  ×
                </button>
              )}
              {onSpeedChange && (
                <select
                  value={step.speed ?? "normal"}
                  onChange={(e) => onSpeedChange(index, e.target.value as KeyframeSpeed)}
                  disabled={busy}
                  title="Schritt-Tempo (Übergang zum nächsten Keyframe)"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[11px] text-slate-400 disabled:opacity-60"
                >
                  {speeds.map((speed) => (
                    <option key={speed} value={speed}>
                      {KEYFRAME_SPEED_LABELS[speed]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddStep}
          disabled={busy}
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Schritt hinzufügen
        </button>
        <button
          type="button"
          onClick={onExportVideo}
          disabled={!canPlay || busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Video exportieren
        </button>
        <button
          type="button"
          onClick={onExportGif}
          disabled={!canPlay || busy}
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          GIF exportieren
        </button>
      </div>

      {isExporting && (
        <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm text-emerald-100">
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
              <span>
                {exportLabel ?? "Export läuft"}: {Math.round(exportPercent)}%
              </span>
            </span>
            <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-slate-950">
              {Math.round(exportPercent)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-150"
              style={{ width: `${Math.min(100, Math.max(0, exportPercent))}%` }}
            />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Video- und GIF-Export laufen mit 30 Bildern/Sekunde.
      </p>
    </div>
  );
}
