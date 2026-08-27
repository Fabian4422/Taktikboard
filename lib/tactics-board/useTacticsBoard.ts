"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BoardElement,
  Keyframe,
  TacticsBoardDocument,
  ToolMode,
  getDefaultScale,
  cloneElements,
  createEmptyKeyframe,
  deepCloneKeyframe,
  interpolateElementsTimed,
  getPlaybackPlan,
  isRotatable,
  isPlayerType,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  DEFAULT_PLAYER_SCALE_PERCENT,
  DEFAULT_CONE_COLOR,
  migrateDocumentToCurrentField,
  type FieldRotation,
  type FieldView,
  type KeyframeSpeed,
  type PlaybackRate,
} from "@/lib/tactics-board/types";
import { nextFieldRotation } from "@/lib/tactics-board/fieldLayout";
import { createId } from "@/lib/uuid";

const DEFAULT_DOCUMENT: TacticsBoardDocument = {
  name: "Neues Taktikboard",
  keyframes: [createEmptyKeyframe(1)],
  fieldWidth: FIELD_WIDTH,
  fieldHeight: FIELD_HEIGHT,
};

const LINE_TYPES = new Set(["pass-line", "run-path", "dribble-path", "guide-line"]);

function nextPlayerNumber(
  elements: BoardElement[],
  type: "player-a" | "player-b" | "player-c" | "player-d",
): number {
  const numbers = elements
    .filter((el) => el.type === type && el.number != null)
    .map((el) => el.number!);
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

export function useTacticsBoard(initialDocument?: TacticsBoardDocument) {
  const [document, setDocument] = useState<TacticsBoardDocument>(
    initialDocument ?? DEFAULT_DOCUMENT,
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [lineDraft, setLineDraft] = useState<{ x: number; y: number } | null>(null);
  const [displayElements, setDisplayElements] = useState<BoardElement[]>([]);
  const [fieldView, setFieldView] = useState<FieldView>(initialDocument?.fieldView ?? "full");
  const [fieldRotation, setFieldRotation] = useState<FieldRotation>(
    initialDocument?.fieldRotation ?? 90,
  );
  const [playerScalePercent, setPlayerScalePercentState] = useState(DEFAULT_PLAYER_SCALE_PERCENT);
  const [coneColor, setConeColor] = useState(DEFAULT_CONE_COLOR);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);

  const animationRef = useRef<number | null>(null);
  const playbackRateRef = useRef(playbackRate);
  const timelineElapsedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  playbackRateRef.current = playbackRate;

  const currentKeyframe = document.keyframes[currentStepIndex] ?? document.keyframes[0];

  useEffect(() => {
    if (!isPlaying && !isPaused) {
      setDisplayElements(cloneElements(currentKeyframe.elements));
      setPlaybackProgress(0);
    }
  }, [currentKeyframe, isPlaying, isPaused, currentStepIndex]);

  const updateCurrentElements = useCallback(
    (updater: (elements: BoardElement[]) => BoardElement[]) => {
      setDocument((prev) => {
        const keyframes = [...prev.keyframes];
        const kf = deepCloneKeyframe(keyframes[currentStepIndex]);
        kf.elements = updater(kf.elements);
        keyframes[currentStepIndex] = kf;
        return { ...prev, keyframes };
      });
    },
    [currentStepIndex],
  );

  const handleElementMove = useCallback(
    (id: string, x: number, y: number) => {
      if (isPlaying) return;
      updateCurrentElements((elements) =>
        elements.map((el) => (el.id === id ? { ...el, x, y } : el)),
      );
    },
    [isPlaying, updateCurrentElements],
  );

  const handleElementTransform = useCallback(
    (id: string, x: number, y: number, rotation: number) => {
      if (isPlaying) return;
      updateCurrentElements((elements) =>
        elements.map((el) => (el.id === id ? { ...el, x, y, rotation } : el)),
      );
    },
    [isPlaying, updateCurrentElements],
  );

  const rotateSelected = useCallback(
    (delta: number) => {
      if (!selectedId || isPlaying) return;
      updateCurrentElements((elements) =>
        elements.map((el) => {
          if (el.id !== selectedId || !isRotatable(el.type)) return el;
          const next = ((el.rotation ?? 0) + delta) % 360;
          return { ...el, rotation: next < 0 ? next + 360 : next };
        }),
      );
    },
    [isPlaying, selectedId, updateCurrentElements],
  );

  const handleLineMove = useCallback(
    (id: string, dx: number, dy: number) => {
      if (isPlaying) return;
      updateCurrentElements((elements) =>
        elements.map((el) => {
          if (el.id !== id || !el.points) return el;
          return {
            ...el,
            x: el.x + dx,
            y: el.y + dy,
            points: el.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
          };
        }),
      );
    },
    [isPlaying, updateCurrentElements],
  );

  const handleFieldClick = useCallback(
    (x: number, y: number) => {
      if (isPlaying || toolMode === "select") return;

      if (LINE_TYPES.has(toolMode)) {
        if (!lineDraft) {
          setLineDraft({ x, y });
          return;
        }

        const newElement: BoardElement = {
          id: createId(),
          type: toolMode,
          x: lineDraft.x,
          y: lineDraft.y,
          points: [lineDraft.x, lineDraft.y, x, y],
        };

        updateCurrentElements((els) => [...els, newElement]);
        setLineDraft(null);
        setToolMode("select");
        setSelectedId(newElement.id);
        return;
      }

      const base: BoardElement = {
        id: createId(),
        type: toolMode,
        x,
        y,
        rotation: isRotatable(toolMode) ? 0 : undefined,
        scale: isPlayerType(toolMode)
          ? playerScalePercent / 100
          : getDefaultScale(toolMode),
        color: toolMode === "cone" ? coneColor : undefined,
      };

      if (toolMode === "player-a") {
        base.number = nextPlayerNumber(currentKeyframe.elements, "player-a");
      } else if (toolMode === "player-b") {
        base.number = nextPlayerNumber(currentKeyframe.elements, "player-b");
      } else if (toolMode === "player-c") {
        base.number = nextPlayerNumber(currentKeyframe.elements, "player-c");
      } else if (toolMode === "player-d") {
        base.number = nextPlayerNumber(currentKeyframe.elements, "player-d");
      }

      updateCurrentElements((els) => [...els, base]);
      setSelectedId(base.id);
      setToolMode("select");
    },
    [
      coneColor,
      currentKeyframe.elements,
      isPlaying,
      lineDraft,
      playerScalePercent,
      toolMode,
      updateCurrentElements,
    ],
  );

  const addKeyframe = useCallback(() => {
    setDocument((prev) => {
      const last = prev.keyframes[prev.keyframes.length - 1];
      const newIndex = prev.keyframes.length + 1;
      const newKeyframe: Keyframe = {
        id: createId(),
        label: `Schritt ${newIndex}`,
        elements: cloneElements(last.elements),
        speed: last.speed ?? "normal",
      };
      const keyframes = [...prev.keyframes, newKeyframe];
      setCurrentStepIndex(keyframes.length - 1);
      return { ...prev, keyframes };
    });
  }, []);

  const deleteKeyframe = useCallback(
    (index: number) => {
      if (document.keyframes.length <= 1) return;
      setDocument((prev) => ({
        ...prev,
        keyframes: prev.keyframes.filter((_, i) => i !== index),
      }));
      setCurrentStepIndex((i) => Math.min(i, document.keyframes.length - 2));
    },
    [document.keyframes.length],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    updateCurrentElements((els) => els.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, updateCurrentElements]);

  const updateSelectedElement = useCallback(
    (patch: Partial<Pick<BoardElement, "x" | "y" | "scale" | "number" | "color">>) => {
      if (!selectedId || isPlaying) return;
      updateCurrentElements((elements) =>
        elements.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)),
      );
    },
    [isPlaying, selectedId, updateCurrentElements],
  );

  const setPlayerScalePercent = useCallback((percent: number) => {
    const clamped = Math.max(25, Math.min(200, Math.round(percent)));
    setPlayerScalePercentState(clamped);
    const scale = clamped / 100;
    setDocument((doc) => ({
      ...doc,
      keyframes: doc.keyframes.map((kf) => ({
        ...kf,
        elements: kf.elements.map((el) =>
          isPlayerType(el.type) ? { ...el, scale } : el,
        ),
      })),
    }));
  }, []);

  const setKeyframeSpeed = useCallback((index: number, speed: KeyframeSpeed) => {
    if (isPlaying) return;
    setDocument((prev) => {
      const keyframes = [...prev.keyframes];
      if (!keyframes[index]) return prev;
      keyframes[index] = { ...keyframes[index], speed };
      return { ...prev, keyframes };
    });
  }, [isPlaying]);

  const setAllKeyframeSpeeds = useCallback((speed: KeyframeSpeed) => {
    if (isPlaying) return;
    setDocument((prev) => ({
      ...prev,
      keyframes: prev.keyframes.map((kf) => ({ ...kf, speed })),
    }));
  }, [isPlaying]);

  const rotateField = useCallback(() => {
    // 90° im Uhrzeigersinn — nur Darstellung, Element-Koordinaten bleiben gleich
    setFieldRotation((prev) => nextFieldRotation(prev));
  }, []);

  const clearBoard = useCallback(() => {
    if (isPlaying) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm("Wirklich alles löschen? Alle Spieler, Materialien und Linien werden entfernt.");
    if (!confirmed) return;

    setDocument((prev) => ({
      ...prev,
      keyframes: [createEmptyKeyframe(1)],
    }));
    setCurrentStepIndex(0);
    setSelectedId(null);
    setLineDraft(null);
    setToolMode("select");
    setIsPlaying(false);
    setIsPaused(false);
    setPlaybackProgress(0);
    timelineElapsedRef.current = 0;
    lastFrameRef.current = null;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, [isPlaying]);

  const changeFieldView = useCallback((next: FieldView) => {
    // Nur Viewport wechseln — keine Drehung, keine Koordinaten-Änderung.
    setFieldView(next);
  }, []);

  const applyDocument = useCallback((doc: TacticsBoardDocument) => {
    const migrated = migrateDocumentToCurrentField(doc);
    setDocument(migrated);
    setFieldView(migrated.fieldView ?? "full");
    setFieldRotation(migrated.fieldRotation ?? 90);
    setCurrentStepIndex(0);
    setSelectedId(null);
    setIsPlaying(false);
    setIsPaused(false);
    setPlaybackProgress(0);
    setLineDraft(null);
    setToolMode("select");
    timelineElapsedRef.current = 0;
    lastFrameRef.current = null;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const startPlayback = useCallback(() => {
    if (document.keyframes.length < 2) return;
    setIsPaused(false);
    setIsPlaying(true);
    if (!isPaused) {
      timelineElapsedRef.current = 0;
      setPlaybackProgress(0);
    }
    lastFrameRef.current = null;
  }, [document.keyframes.length, isPaused]);

  const pausePlayback = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    timelineElapsedRef.current = 0;
    lastFrameRef.current = null;
    setPlaybackProgress(0);
    setCurrentStepIndex(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return;
    }

    const { timings, totalMs } = getPlaybackPlan(document.keyframes);
    if (timings.length === 0 || totalMs <= 0) {
      setIsPlaying(false);
      return;
    }

    const tick = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }
      const dt = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;
      timelineElapsedRef.current += dt * playbackRateRef.current;
      const elapsed = timelineElapsedRef.current;

      let remaining = elapsed;
      let fromIndex = 0;
      while (fromIndex < timings.length && remaining > timings[fromIndex].durationMs) {
        remaining -= timings[fromIndex].durationMs;
        fromIndex += 1;
      }

      if (fromIndex >= timings.length) {
        const last = document.keyframes[document.keyframes.length - 1];
        setDisplayElements(cloneElements(last.elements));
        setPlaybackProgress(1);
        setIsPlaying(false);
        setIsPaused(false);
        timelineElapsedRef.current = 0;
        lastFrameRef.current = null;
        setCurrentStepIndex(document.keyframes.length - 1);
        return;
      }

      const fromKf = document.keyframes[fromIndex];
      const toKf = document.keyframes[fromIndex + 1];
      const timing = timings[fromIndex];
      const interpolated = interpolateElementsTimed(fromKf.elements, toKf.elements, remaining, timing);
      setDisplayElements(
        interpolated
          .filter((el) => el.opacity > 0.05)
          .map(({ opacity: _o, ...el }) => el),
      );
      setPlaybackProgress(Math.min(elapsed / totalMs, 1));

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [document.keyframes, isPlaying]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === "r" || e.key === "R") {
        if (selectedId && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          rotateSelected(e.shiftKey ? -45 : 45);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, rotateSelected, selectedId]);

  const elementsToRender = isPlaying || isPaused ? displayElements : currentKeyframe.elements;
  const selectedElement = selectedId
    ? (elementsToRender.find((el) => el.id === selectedId) ?? null)
    : null;

  return {
    document,
    setDocument,
    applyDocument,
    currentStepIndex,
    setCurrentStepIndex,
    toolMode,
    setToolMode,
    selectedId,
    setSelectedId,
    isPlaying,
    isPaused,
    playbackProgress,
    lineDraft,
    elementsToRender,
    selectedElement,
    handleElementMove,
    handleElementTransform,
    handleLineMove,
    handleFieldClick,
    addKeyframe,
    deleteKeyframe,
    deleteSelected,
    rotateSelected,
    fieldView,
    setFieldView: changeFieldView,
    fieldRotation,
    rotateField,
    clearBoard,
    playerScalePercent,
    setPlayerScalePercent,
    coneColor,
    setConeColor,
    startPlayback,
    pausePlayback,
    stopPlayback,
    playbackRate,
    setPlaybackRate,
    setKeyframeSpeed,
    setAllKeyframeSpeeds,
    updateCurrentElements,
    updateSelectedElement,
  };
}

export type TacticsBoardState = ReturnType<typeof useTacticsBoard>;
