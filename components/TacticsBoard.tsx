"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { Toolbar } from "./tactics-board/Toolbar";
import { Timeline } from "./tactics-board/Timeline";
import { ObjectInspector } from "./tactics-board/ObjectInspector";
import { PlaybackBar } from "./tactics-board/PlaybackBar";
import { useTacticsBoard } from "@/lib/tactics-board/useTacticsBoard";
import {
  saveTacticsBoard,
  loadTacticsBoard,
  isSupabaseConfigured,
} from "@/lib/tactics-board/supabase";
import { exportTacticsAnimation, type ExportFormat } from "@/lib/tactics-board/exportAnimation";
import { FIELD_HEIGHT, FIELD_WIDTH } from "@/lib/tactics-board/types";
import {
  notifyExportComplete,
  requestExportNotificationPermission,
  restoreTabTitle,
  setExportTabTitle,
} from "@/lib/tactics-board/exportNotifications";
import { ExerciseLibraryModal } from "./tactics-board/ExerciseLibraryModal";

const FieldCanvas = dynamic(
  () => import("./tactics-board/FieldCanvas").then((m) => m.FieldCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-700 bg-emerald-900/30">
        <span className="text-slate-400">Spielfeld wird geladen…</span>
      </div>
    ),
  },
);

interface TacticsBoardProps {
  exerciseId?: string;
  initialName?: string;
}

export function TacticsBoard({ exerciseId, initialName }: TacticsBoardProps) {
  const router = useRouter();
  const board = useTacticsBoard();
  const { applyDocument } = board;
  const stageRef = useRef<Konva.Stage | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [boardName, setBoardName] = useState(initialName ?? "Neues Taktikboard");
  const [isLoading, setIsLoading] = useState(Boolean(exerciseId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportState, setExportState] = useState<{
    label: string;
    percent: number;
  } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const pageTitleRef = useRef(
    typeof document === "undefined" ? "Taktikboard" : document.title,
  );

  useEffect(() => {
    if (!exerciseId || !isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setLoadError(null);

      const { document, error } = await loadTacticsBoard(exerciseId);
      if (cancelled) return;

      if (document) {
        applyDocument(document);
        setBoardName(document.name);
      } else {
        setLoadError(error ?? "Übung konnte nicht geladen werden.");
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [exerciseId, applyDocument]);

  const handleSave = useCallback(async () => {
    setSaveStatus("Speichern…");
    setLoadError(null);

    try {
      const result = await saveTacticsBoard(
        {
          ...board.document,
          name: boardName,
          exerciseId,
          fieldView: board.fieldView,
          fieldRotation: board.fieldRotation,
        },
        { exerciseId, name: boardName },
      );

      console.log("[TacticsBoard] save result", result);

      if (result.success && result.id) {
        board.setDocument((prev) => ({ ...prev, id: result.id }));
        router.replace(
          `/admin/tactics-board?exerciseId=${encodeURIComponent(result.id)}&name=${encodeURIComponent(boardName)}`,
        );
        setSaveStatus("Gespeichert!");
        window.setTimeout(() => setSaveStatus(null), 3000);
        return;
      }

      const message = result.error ?? "Fehler beim Speichern";
      console.error("[TacticsBoard] Speichern fehlgeschlagen:", message);
      setSaveStatus(message);
      setLoadError(message);
      window.alert(`Speichern fehlgeschlagen:\n\n${message}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unerwarteter Fehler beim Speichern.";
      console.error("[TacticsBoard] Speichern Exception:", error);
      setSaveStatus(message);
      setLoadError(message);
      window.alert(`Speichern fehlgeschlagen:\n\n${message}`);
    }
  }, [board, boardName, exerciseId, router]);

  const handleLibraryLoad = useCallback(
    async (id: string, title: string) => {
      setLibraryOpen(false);
      setIsLoading(true);
      setLoadError(null);
      board.stopPlayback();

      const { document, error } = await loadTacticsBoard(id);
      if (document) {
        applyDocument(document);
        setBoardName(document.name || title);
        router.replace(
          `/admin/tactics-board?exerciseId=${encodeURIComponent(id)}&name=${encodeURIComponent(document.name || title)}`,
        );
      } else {
        setLoadError(error ?? "Übung konnte nicht geladen werden.");
      }

      setIsLoading(false);
    },
    [applyDocument, board, router],
  );

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }
    try {
      await previewRef.current?.requestFullscreen();
    } catch {
      setIsFullscreen(true);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  const showInspector = !isFullscreen && !exportState && Boolean(board.selectedElement);

  const canPlay = board.document.keyframes.length >= 2;
  const isExporting = Boolean(exportState);

  useEffect(() => {
    if (!exportState) {
      restoreTabTitle(pageTitleRef.current);
      return;
    }
    setExportTabTitle(exportState.percent);
  }, [exportState]);

  useEffect(() => {
    return () => restoreTabTitle(pageTitleRef.current);
  }, []);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (isExporting || board.document.keyframes.length < 2) return;

      board.stopPlayback();
      const startLabel = format === "gif" ? "GIF wird gerendert" : "Video wird gerendert";
      pageTitleRef.current = document.title;
      setExportState({ label: startLabel, percent: 0 });
      setExportTabTitle(0);
      void requestExportNotificationPermission();

      try {
        const result = await exportTacticsAnimation({
          keyframes: board.document.keyframes,
          fieldView: board.fieldView,
          fieldRotation: board.fieldRotation,
          format,
          fileBaseName: boardName,
          onProgress: (percent, label) => {
            setExportState({ label, percent });
            setExportTabTitle(percent);
          },
        });
        notifyExportComplete(result.usedGifFallback ? "gif" : format);
        if (result.usedGifFallback) {
          setSaveStatus("Video nicht unterstützt – GIF wurde gespeichert.");
          window.setTimeout(() => setSaveStatus(null), 4000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Export fehlgeschlagen.";
        setExportState({ label: message, percent: 0 });
        await new Promise((resolve) => window.setTimeout(resolve, 2800));
      } finally {
        restoreTabTitle(pageTitleRef.current);
        setExportState(null);
      }
    },
    [board, boardName, isExporting],
  );

  if (isLoading) {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8">
        <p className="text-lg font-medium text-white">Übung wird geladen…</p>
        <p className="text-sm text-slate-400">Einen Moment bitte.</p>
      </main>
    );
  }

  return (
    <div className="relative mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
      {!isFullscreen && (
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Taktikboard</h1>
              {isExporting && exportState && (
                <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-slate-950">
                  {Math.round(exportState.percent)}%
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">
              Übungen visualisieren, animieren und als Video/GIF exportieren
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PlaybackBar
              isPlaying={board.isPlaying}
              isPaused={board.isPaused}
              canPlay={canPlay && !isExporting}
              playbackRate={board.playbackRate}
              onPlaybackRateChange={board.setPlaybackRate}
              onPlay={board.startPlayback}
              onPause={board.pausePlayback}
              onStop={board.stopPlayback}
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Vollbild
            </button>
            <input
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
              placeholder="Name des Boards"
            />
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Bibliothek öffnen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              In Supabase speichern
            </button>
            {!isSupabaseConfigured() && (
              <span className="text-xs text-amber-400">Supabase nicht konfiguriert</span>
            )}
            {loadError && <span className="text-sm text-red-400">{loadError}</span>}
            {saveStatus && <span className="text-sm text-slate-400">{saveStatus}</span>}
          </div>
        </header>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {!isFullscreen && (
          <Toolbar
            toolMode={board.toolMode}
            onToolChange={board.setToolMode}
            onDeleteSelected={board.deleteSelected}
            hasSelection={Boolean(board.selectedId)}
            fieldView={board.fieldView}
            fieldRotation={board.fieldRotation}
            onFieldViewChange={board.setFieldView}
            onRotateField={board.rotateField}
            onClearBoard={board.clearBoard}
            playerScalePercent={board.playerScalePercent}
            onPlayerScalePercentChange={board.setPlayerScalePercent}
            coneColor={board.coneColor}
            onConeColorChange={board.setConeColor}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div
            ref={previewRef}
            className={
              isFullscreen
                ? "fixed inset-0 z-50 flex flex-col bg-slate-950 p-4"
                : "relative"
            }
          >
            {isFullscreen && (
              <div className="mb-3 flex items-center justify-between gap-3">
                <PlaybackBar
                  isPlaying={board.isPlaying}
                  isPaused={board.isPaused}
                  canPlay={canPlay}
                  playbackProgress={board.playbackProgress}
                  playbackRate={board.playbackRate}
                  onPlaybackRateChange={board.setPlaybackRate}
                  compact
                  onPlay={board.startPlayback}
                  onPause={board.pausePlayback}
                  onStop={board.stopPlayback}
                />
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Vollbild beenden
                </button>
              </div>
            )}
            <div
              className={
                isFullscreen
                  ? "relative flex min-h-0 flex-1 flex-col"
                  : "relative aspect-video w-full min-w-0"
              }
            >
              <FieldCanvas
                stageRef={stageRef}
                elements={board.elementsToRender}
                selectedId={isExporting ? null : board.selectedId}
                toolMode={board.toolMode}
                lineDraft={isFullscreen || isExporting ? null : board.lineDraft}
                isPlaying={board.isPlaying}
                onSelect={board.setSelectedId}
                onElementMove={board.handleElementMove}
                onLineMove={board.handleLineMove}
                onFieldClick={board.handleFieldClick}
                onElementTransform={board.handleElementTransform}
                fieldView={board.fieldView}
                fieldRotation={board.fieldRotation}
                fillParent
                preview={isFullscreen || isExporting}
              />
              {isExporting && exportState && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-4">
                  <div
                    className="w-[min(28rem,100%)] rounded-2xl border border-emerald-400/40 bg-slate-900 p-6 shadow-2xl"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-emerald-100">
                        {exportState.label}: {Math.round(exportState.percent)}%
                      </p>
                      <span className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-bold text-slate-950">
                        {Math.round(exportState.percent)}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-[width] duration-150"
                        style={{
                          width: `${Math.min(100, Math.max(0, exportState.percent))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      Der Export läuft im Hintergrund weiter – du kannst den Tab minimieren.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isFullscreen && (
            <>
              <Timeline
                steps={board.document.keyframes.map((kf) => ({
                  id: kf.id,
                  label: kf.label,
                  speed: kf.speed,
                }))}
                currentIndex={board.currentStepIndex}
                isPlaying={board.isPlaying}
                isPaused={board.isPaused}
                isExporting={isExporting}
                exportLabel={exportState?.label}
                exportPercent={exportState?.percent ?? 0}
                playbackProgress={board.playbackProgress}
                playbackRate={board.playbackRate}
                onSelectStep={board.setCurrentStepIndex}
                onAddStep={board.addKeyframe}
                onDeleteStep={board.deleteKeyframe}
                onPlay={board.startPlayback}
                onPause={board.pausePlayback}
                onStop={board.stopPlayback}
                onSpeedChange={board.setKeyframeSpeed}
                onSetAllSpeeds={board.setAllKeyframeSpeeds}
                onPlaybackRateChange={board.setPlaybackRate}
                onExportVideo={() => void handleExport("video")}
                onExportGif={() => void handleExport("gif")}
              />
            </>
          )}
        </div>
      </div>

      {showInspector && board.selectedElement && (
        <ObjectInspector
          element={board.selectedElement}
          onUpdate={board.updateSelectedElement}
          onClose={() => board.setSelectedId(null)}
          onRotate={board.rotateSelected}
          onDelete={board.deleteSelected}
        />
      )}

      <ExerciseLibraryModal
        open={libraryOpen}
        currentId={board.document.id ?? exerciseId}
        onClose={() => setLibraryOpen(false)}
        onLoad={(id, title) => void handleLibraryLoad(id, title)}
      />
    </div>
  );
}

export { FIELD_WIDTH, FIELD_HEIGHT };
