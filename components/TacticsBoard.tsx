"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import {
  EXPORT_VIDEO_HEIGHT,
  EXPORT_VIDEO_WIDTH,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  type BoardElement,
} from "@/lib/tactics-board/types";
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
  const exportStageRef = useRef<Konva.Stage | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [boardName, setBoardName] = useState(initialName ?? "Neues Taktikboard");
  const [isLoading, setIsLoading] = useState(Boolean(exerciseId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportStageMounted, setExportStageMounted] = useState(false);
  const [exportOverride, setExportOverride] = useState<BoardElement[] | null>(null);
  const [exportState, setExportState] = useState<{
    label: string;
    percent: number;
  } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const sceneReadyRef = useRef<(() => void) | null>(null);

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

  const waitForExportStage = useCallback(async () => {
    const deadline = performance.now() + 4000;
    while (performance.now() < deadline) {
      const stage = exportStageRef.current;
      if (stage && stage.width() > 0 && stage.height() > 0) return stage;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    throw new Error("Export-Canvas ist noch nicht bereit.");
  }, []);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (isExporting || board.document.keyframes.length < 2) return;
      const liveStage = stageRef.current;
      if (!liveStage) {
        setExportState({ label: "Spielfeld ist noch nicht bereit.", percent: 0 });
        window.setTimeout(() => setExportState(null), 2500);
        return;
      }

      board.stopPlayback();
      const startLabel = format === "gif" ? "GIF wird erstellt…" : "Video wird erstellt…";
      // Offscreen-Stage in 1920×1080 (16:9) mounten — Hauptboard bleibt unverändert
      setExportStageMounted(true);
      setExportOverride(board.elementsToRender);
      setExportState({ label: startLabel, percent: 0 });

      try {
        const stage = await waitForExportStage();
        const result = await exportTacticsAnimation({
          keyframes: board.document.keyframes,
          stage,
          format,
          fileBaseName: boardName,
          onProgress: (percent, label) => {
            setExportState({ label, percent });
          },
          renderFrame: async (elements) => {
            await new Promise<void>((resolve) => {
              let settled = false;
              const done = () => {
                if (settled) return;
                settled = true;
                sceneReadyRef.current = null;
                resolve();
              };
              sceneReadyRef.current = done;
              flushSync(() => {
                setExportOverride(elements);
              });
              queueMicrotask(() => {
                if (settled) return;
                exportStageRef.current?.batchDraw();
                done();
              });
            });
          },
        });
        if (result.usedGifFallback) {
          setSaveStatus("Video nicht unterstützt – GIF wurde gespeichert.");
          window.setTimeout(() => setSaveStatus(null), 4000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Export fehlgeschlagen.";
        setExportState({ label: message, percent: 0 });
        await new Promise((resolve) => window.setTimeout(resolve, 2800));
      } finally {
        setExportOverride(null);
        setExportStageMounted(false);
        setExportState(null);
      }
    },
    [board, boardName, isExporting, waitForExportStage],
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
            <h1 className="text-2xl font-bold text-white">Taktikboard</h1>
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
            onFieldViewChange={board.setFieldView}
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
                  ? "flex min-h-0 flex-1 flex-col"
                  : "aspect-video w-full min-w-0"
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
            </div>

            {/* Versteckte Export-Stage: fest 1920×1080 (16:9) für YouTube */}
            {isExporting && exportStageMounted && (
              <div
                aria-hidden
                className="pointer-events-none fixed overflow-hidden opacity-0"
                style={{
                  left: -10000,
                  top: 0,
                  width: EXPORT_VIDEO_WIDTH,
                  height: EXPORT_VIDEO_HEIGHT,
                }}
              >
                <FieldCanvas
                  stageRef={exportStageRef}
                  width={EXPORT_VIDEO_WIDTH}
                  height={EXPORT_VIDEO_HEIGHT}
                  elements={exportOverride ?? board.elementsToRender}
                  selectedId={null}
                  toolMode="select"
                  lineDraft={null}
                  isPlaying={false}
                  onSelect={() => undefined}
                  onElementMove={() => undefined}
                  onLineMove={() => undefined}
                  onFieldClick={() => undefined}
                  fieldView={board.fieldView}
                  fieldRotation={board.fieldRotation}
                  fillParent
                  preview
                  sceneReadyRef={sceneReadyRef}
                />
              </div>
            )}
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
