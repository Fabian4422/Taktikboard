"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BoardElement,
  Keyframe,
  TacticsBoardDocument,
  ToolMode,
  ElementType,
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
  getElementScale,
  type FieldRotation,
  type FieldView,
  type KeyframeSpeed,
  type PlaybackRate,
} from "@/lib/tactics-board/types";
import {
  migrateTacticsDocument,
  nextFieldRotation,
  viewportUprightElementRotation,
} from "@/lib/tactics-board/fieldLayout";
import { createId } from "@/lib/uuid";

const DEFAULT_DOCUMENT: TacticsBoardDocument = {
  name: "Neues Taktikboard",
  keyframes: [createEmptyKeyframe(1)],
  fieldWidth: FIELD_WIDTH,
  fieldHeight: FIELD_HEIGHT,
  coordSpace: "viewport",
};

const LINE_TYPES = new Set(["pass-line", "run-path", "dribble-path", "guide-line"]);
const CASCADE_POSITION_EPS = 1.5;
const CASCADE_ROTATION_EPS = 1;
const CASCADE_SCALE_EPS = 0.01;

function cloneBoardElement(el: BoardElement): BoardElement {
  return {
    ...el,
    points: el.points ? [...el.points] : undefined,
  };
}

function pointsDiffer(
  a: number[] | undefined,
  b: number[] | undefined,
  eps = CASCADE_POSITION_EPS,
): boolean {
  if (!a && !b) return false;
  if (!a || !b || a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > eps) return true;
  }
  return false;
}

/** True, wenn der Folgeschritt für dieses Objekt schon manuell abweicht. */
function hasManualOverride(prev: BoardElement, curr: BoardElement): boolean {
  if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > CASCADE_POSITION_EPS) return true;
  const rotA = prev.rotation ?? 0;
  const rotB = curr.rotation ?? 0;
  let rotDiff = Math.abs(rotB - rotA) % 360;
  if (rotDiff > 180) rotDiff = 360 - rotDiff;
  if (rotDiff > CASCADE_ROTATION_EPS) return true;
  if (Math.abs(getElementScale(curr) - getElementScale(prev)) > CASCADE_SCALE_EPS) return true;
  if ((curr.color ?? "") !== (prev.color ?? "")) return true;
  if (curr.number !== prev.number) return true;
  if (pointsDiffer(prev.points, curr.points)) return true;
  return false;
}

function findElement(elements: BoardElement[], id: string): BoardElement | undefined {
  return elements.find((el) => el.id === id);
}

/**
 * Schreibt eine Element-Änderung in den aktuellen Keyframe und übernimmt sie
 * kaskadierend in Folgeschritte, solange das Objekt dort noch dem vorherigen
 * Schritt entspricht (kein manueller Override).
 */
function applyCascadingElementChange(
  keyframes: Keyframe[],
  fromIndex: number,
  elementId: string,
  nextElement: BoardElement | null,
): Keyframe[] {
  const originals = keyframes.map((kf) => cloneElements(kf.elements));
  const next = keyframes.map((kf) => deepCloneKeyframe(kf));

  const currentEls = next[fromIndex].elements;
  if (nextElement === null) {
    next[fromIndex] = {
      ...next[fromIndex],
      elements: currentEls.filter((el) => el.id !== elementId),
    };
  } else {
    const idx = currentEls.findIndex((el) => el.id === elementId);
    if (idx >= 0) {
      const els = [...currentEls];
      els[idx] = cloneBoardElement(nextElement);
      next[fromIndex] = { ...next[fromIndex], elements: els };
    } else {
      next[fromIndex] = {
        ...next[fromIndex],
        elements: [...currentEls, cloneBoardElement(nextElement)],
      };
    }
  }

  for (let k = fromIndex + 1; k < next.length; k++) {
    const prevOrig = findElement(originals[k - 1], elementId);
    const currOrig = findElement(originals[k], elementId);

    if (nextElement === null) {
      if (!currOrig) break;
      if (prevOrig && hasManualOverride(prevOrig, currOrig)) break;
      next[k] = {
        ...next[k],
        elements: next[k].elements.filter((el) => el.id !== elementId),
      };
      continue;
    }

    if (!currOrig) {
      // Objekt fehlte im Folgeschritt — Kette beenden (außer reines Add unten).
      break;
    }
    if (!prevOrig || hasManualOverride(prevOrig, currOrig)) break;

    const source = findElement(next[k - 1].elements, elementId);
    if (!source) break;
    next[k] = {
      ...next[k],
      elements: next[k].elements.map((el) =>
        el.id === elementId ? cloneBoardElement(source) : el,
      ),
    };
  }

  return next;
}

function applyCascadingElementAdd(
  keyframes: Keyframe[],
  fromIndex: number,
  element: BoardElement,
): Keyframe[] {
  const next = keyframes.map((kf) => deepCloneKeyframe(kf));
  next[fromIndex] = {
    ...next[fromIndex],
    elements: [...next[fromIndex].elements, cloneBoardElement(element)],
  };

  for (let k = fromIndex + 1; k < next.length; k++) {
    if (findElement(next[k].elements, element.id)) break;
    next[k] = {
      ...next[k],
      elements: [...next[k].elements, cloneBoardElement(element)],
    };
  }

  return next;
}

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
  const [coneColor, setConeColorState] = useState(DEFAULT_CONE_COLOR);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const clipboardRef = useRef<BoardElement | null>(null);
  /** Merkzustand für Stempel: Farbe/Größe/Rotation des zuletzt angepassten Objekts. */
  const stampMemoryRef = useRef<{
    type: ElementType;
    color?: string;
    scale?: number;
    rotation?: number;
  } | null>(null);

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

  const mutateElementWithCascade = useCallback(
    (elementId: string, mutate: (el: BoardElement) => BoardElement | null) => {
      setDocument((prev) => {
        const current = findElement(prev.keyframes[currentStepIndex]?.elements ?? [], elementId);
        if (!current) return prev;
        const nextElement = mutate(current);
        return {
          ...prev,
          keyframes: applyCascadingElementChange(
            prev.keyframes,
            currentStepIndex,
            elementId,
            nextElement,
          ),
        };
      });
    },
    [currentStepIndex],
  );

  const addElementWithCascade = useCallback(
    (element: BoardElement) => {
      setDocument((prev) => ({
        ...prev,
        keyframes: applyCascadingElementAdd(prev.keyframes, currentStepIndex, element),
      }));
    },
    [currentStepIndex],
  );

  const clearStampMemory = useCallback(() => {
    stampMemoryRef.current = null;
  }, []);

  /** Speichert angepasste Objekt-Eigenschaften als Stempel-Vorlage und aktiviert das Werkzeug. */
  const rememberStampFromElement = useCallback((el: BoardElement) => {
    if (LINE_TYPES.has(el.type) || el.points) return;
    stampMemoryRef.current = {
      type: el.type,
      color: el.color,
      scale: el.scale,
      rotation: el.rotation,
    };
    setToolMode(el.type);
    if (el.color && (el.type === "cone" || el.type === "dummy")) {
      setConeColorState(el.color);
    }
  }, []);

  /**
   * Werkzeugwahl aus der Leiste:
   * - anderes Werkzeug → Memory löschen, neues Werkzeug aktiv
   * - gleiches Material erneut → Memory zurücksetzen (Standard-Ausgangsobjekt)
   */
  const selectTool = useCallback(
    (mode: ToolMode) => {
      setLineDraft(null);
      if (mode !== "select" && mode === toolMode) {
        clearStampMemory();
        return;
      }
      clearStampMemory();
      setToolMode(mode);
    },
    [clearStampMemory, toolMode],
  );

  const setConeColor = useCallback(
    (color: string) => {
      setConeColorState(color);
      const memory = stampMemoryRef.current;
      if (memory && (memory.type === "cone" || memory.type === "dummy")) {
        stampMemoryRef.current = { ...memory, color };
      }
      if (selectedId) {
        const selected = findElement(currentKeyframe.elements, selectedId);
        if (selected && (selected.type === "cone" || selected.type === "dummy")) {
          mutateElementWithCascade(selectedId, (el) => ({ ...el, color }));
          rememberStampFromElement({ ...selected, color });
        }
      }
    },
    [currentKeyframe.elements, mutateElementWithCascade, rememberStampFromElement, selectedId],
  );

  const handleElementMove = useCallback(
    (id: string, x: number, y: number) => {
      if (isPlaying) return;
      mutateElementWithCascade(id, (el) => ({ ...el, x, y }));
    },
    [isPlaying, mutateElementWithCascade],
  );

  const handleElementTransform = useCallback(
    (id: string, x: number, y: number, rotation: number) => {
      if (isPlaying) return;
      const current = findElement(currentKeyframe.elements, id);
      if (!current) return;
      const next = { ...current, x, y, rotation };
      mutateElementWithCascade(id, () => next);
      rememberStampFromElement(next);
    },
    [currentKeyframe.elements, isPlaying, mutateElementWithCascade, rememberStampFromElement],
  );

  const rotateSelected = useCallback(
    (delta: number) => {
      if (!selectedId || isPlaying) return;
      const current = findElement(currentKeyframe.elements, selectedId);
      if (!current || !isRotatable(current.type)) return;
      const nextRot = ((current.rotation ?? 0) + delta) % 360;
      const rotation = nextRot < 0 ? nextRot + 360 : nextRot;
      const next = { ...current, rotation };
      mutateElementWithCascade(selectedId, () => next);
      rememberStampFromElement(next);
    },
    [
      currentKeyframe.elements,
      isPlaying,
      mutateElementWithCascade,
      rememberStampFromElement,
      selectedId,
    ],
  );

  const handleLineMove = useCallback(
    (id: string, dx: number, dy: number) => {
      if (isPlaying) return;
      mutateElementWithCascade(id, (el) => {
        if (!el.points) return el;
        return {
          ...el,
          x: el.x + dx,
          y: el.y + dy,
          points: el.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
        };
      });
    },
    [isPlaying, mutateElementWithCascade],
  );

  const handleFieldClick = useCallback(
    (x: number, y: number) => {
      if (isPlaying || toolMode === "select") return;

      if (LINE_TYPES.has(toolMode)) {
        if (!lineDraft) {
          setLineDraft({ x, y });
          return;
        }

        // Doppel-Tap / Fast-Click: Endpunkt muss sich vom Start unterscheiden
        if (Math.hypot(x - lineDraft.x, y - lineDraft.y) < 6) {
          return;
        }

        const newElement: BoardElement = {
          id: createId(),
          type: toolMode,
          x: lineDraft.x,
          y: lineDraft.y,
          points: [lineDraft.x, lineDraft.y, x, y],
        };

        addElementWithCascade(newElement);
        setLineDraft(null);
        clearStampMemory();
        setToolMode("select");
        setSelectedId(newElement.id);
        return;
      }

      const memory = stampMemoryRef.current;
      const useMemory = Boolean(memory && memory.type === toolMode);

      const base: BoardElement = {
        id: createId(),
        type: toolMode,
        x,
        y,
        rotation:
          useMemory && memory?.rotation != null
            ? memory.rotation
            : isRotatable(toolMode)
              ? viewportUprightElementRotation(fieldRotation)
              : undefined,
        scale:
          useMemory && memory?.scale != null
            ? memory.scale
            : isPlayerType(toolMode)
              ? playerScalePercent / 100
              : getDefaultScale(toolMode),
        color: useMemory
          ? memory?.color
          : toolMode === "cone" || toolMode === "dummy"
            ? coneColor
            : undefined,
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

      addElementWithCascade(base);
      // Stempel-Modus: Objekt nicht selektieren — Panel bleibt zu, weiter stempeln
      setSelectedId(null);
    },
    [
      addElementWithCascade,
      clearStampMemory,
      coneColor,
      currentKeyframe.elements,
      fieldRotation,
      isPlaying,
      lineDraft,
      playerScalePercent,
      toolMode,
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
    mutateElementWithCascade(selectedId, () => null);
    setSelectedId(null);
  }, [mutateElementWithCascade, selectedId]);

  const copySelected = useCallback(() => {
    if (!selectedId || isPlaying) return false;
    const source = findElement(currentKeyframe.elements, selectedId);
    if (!source) return false;
    clipboardRef.current = cloneBoardElement(source);
    return true;
  }, [currentKeyframe.elements, isPlaying, selectedId]);

  const pasteClipboard = useCallback(() => {
    if (isPlaying || !clipboardRef.current) return false;
    const template = clipboardRef.current;
    const offset = 28;
    const pasted: BoardElement = {
      ...cloneBoardElement(template),
      id: createId(),
      x: template.x + offset,
      y: template.y + offset,
      points: template.points
        ? template.points.map((v, i) => (i % 2 === 0 ? v + offset : v + offset))
        : undefined,
    };

    if (
      pasted.type === "player-a" ||
      pasted.type === "player-b" ||
      pasted.type === "player-c" ||
      pasted.type === "player-d"
    ) {
      pasted.number = nextPlayerNumber(currentKeyframe.elements, pasted.type);
    }

    addElementWithCascade(pasted);
    setSelectedId(pasted.id);
    clearStampMemory();
    setToolMode("select");
    return true;
  }, [addElementWithCascade, clearStampMemory, currentKeyframe.elements, isPlaying]);

  const updateSelectedElement = useCallback(
    (patch: Partial<Pick<BoardElement, "x" | "y" | "scale" | "number" | "color">>) => {
      if (!selectedId || isPlaying) return;
      const current = findElement(currentKeyframe.elements, selectedId);
      if (!current) return;
      const next = { ...current, ...patch };
      mutateElementWithCascade(selectedId, () => next);
      if (patch.color !== undefined || patch.scale !== undefined) {
        rememberStampFromElement(next);
      }
    },
    [
      currentKeyframe.elements,
      isPlaying,
      mutateElementWithCascade,
      rememberStampFromElement,
      selectedId,
    ],
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
    const memory = stampMemoryRef.current;
    if (memory && isPlayerType(memory.type)) {
      stampMemoryRef.current = { ...memory, scale };
    }
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
    // Nur Hintergrund drehen — Objekt-X/Y bleiben viewport-starr (Bildschirmachsen).
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
      coordSpace: "viewport",
      keyframes: [createEmptyKeyframe(1)],
    }));
    setCurrentStepIndex(0);
    setSelectedId(null);
    setLineDraft(null);
    clearStampMemory();
    setToolMode("select");
    setIsPlaying(false);
    setIsPaused(false);
    setPlaybackProgress(0);
    timelineElapsedRef.current = 0;
    lastFrameRef.current = null;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, [clearStampMemory, isPlaying]);

  const changeFieldView = useCallback((next: FieldView) => {
    // Nur Viewport wechseln — keine Drehung, keine Koordinaten-Änderung.
    setFieldView(next);
  }, []);

  const applyDocument = useCallback((doc: TacticsBoardDocument) => {
    const migrated = migrateTacticsDocument(doc);
    setDocument(migrated);
    setFieldView(migrated.fieldView ?? "full");
    setFieldRotation(migrated.fieldRotation ?? 90);
    setCurrentStepIndex(0);
    setSelectedId(null);
    setIsPlaying(false);
    setIsPaused(false);
    setPlaybackProgress(0);
    setLineDraft(null);
    clearStampMemory();
    setToolMode("select");
    timelineElapsedRef.current = 0;
    lastFrameRef.current = null;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, [clearStampMemory]);

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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "c" || e.key === "C")) {
        if (selectedId) {
          e.preventDefault();
          copySelected();
        }
        return;
      }
      if (mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        pasteClipboard();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.key === "r" || e.key === "R") {
        if (selectedId) {
          e.preventDefault();
          rotateSelected(e.shiftKey ? -45 : 45);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelected, deleteSelected, pasteClipboard, rotateSelected, selectedId]);

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
    setToolMode: selectTool,
    selectTool,
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
    copySelected,
    pasteClipboard,
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
    updateSelectedElement,
  };
}

export type TacticsBoardState = ReturnType<typeof useTacticsBoard>;
