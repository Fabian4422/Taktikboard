"use client";

import type { PlaybackRate } from "@/lib/tactics-board/types";
import { PLAYBACK_RATE_LABELS, PLAYBACK_RATES } from "@/lib/tactics-board/types";

interface PlaybackBarProps {
  isPlaying: boolean;
  isPaused?: boolean;
  canPlay: boolean;
  playbackProgress?: number;
  playbackRate?: PlaybackRate;
  compact?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPlaybackRateChange?: (rate: PlaybackRate) => void;
}

export function PlaybackBar({
  isPlaying,
  isPaused,
  canPlay,
  playbackProgress,
  playbackRate,
  compact,
  onPlay,
  onPause,
  onStop,
  onPlaybackRateChange,
}: PlaybackBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : ""}`}>
      {playbackRate != null && onPlaybackRateChange && (
        <div className="flex rounded-lg border border-slate-600 bg-slate-950 p-0.5">
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => onPlaybackRateChange(rate)}
              title={`Gesamt-Tempo ${PLAYBACK_RATE_LABELS[rate]}`}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                playbackRate === rate
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {PLAYBACK_RATE_LABELS[rate]}
            </button>
          ))}
        </div>
      )}
      {isPlaying ? (
        <button
          type="button"
          onClick={onPause}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
        >
          Pause
        </button>
      ) : (
        <button
          type="button"
          onClick={onPlay}
          disabled={!canPlay && !isPaused}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPaused ? "Fortsetzen" : "Abspielen"}
        </button>
      )}
      <button
        type="button"
        onClick={onStop}
        disabled={!isPlaying && !isPaused}
        className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Stop
      </button>
      {typeof playbackProgress === "number" && (isPlaying || isPaused) && (
        <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${playbackProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
