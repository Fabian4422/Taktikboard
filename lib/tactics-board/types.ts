import { createId } from "@/lib/uuid";

/**
 * Logisches Spielfeld in FIFA-Proportion (105×68).
 * Koordinaten bleiben unverändert — 16:9 entsteht nur durch Letterboxing.
 */
export const FIELD_WIDTH = 1050;
export const FIELD_HEIGHT = 680;

/** Zwischenzeitlich fälschlich gestrecktes Feldmaß (Migration zurück auf FIFA). */
export const STRETCHED_FIELD_WIDTH = 1920;
export const STRETCHED_FIELD_HEIGHT = 1080;

/** Anzeige- und Export-Rahmen (YouTube-tauglich, Letterbox). */
export const DISPLAY_ASPECT_RATIO = 16 / 9;
export const EXPORT_VIDEO_WIDTH = 1920;
export const EXPORT_VIDEO_HEIGHT = 1080;
export const EXPORT_GIF_WIDTH = 1280;
export const EXPORT_GIF_HEIGHT = 720;
export const LETTERBOX_COLOR = "#0f172a";

export type FieldView = "full" | "half" | "half-blank" | "penalty" | "free";
export type FieldRotation = 0 | 90 | 180 | 270;

export type PlayerType = "player-a" | "player-b" | "player-c" | "player-d" | "player-gk";
export type EquipmentType = "cone" | "hurdle" | "mini-goal" | "big-goal" | "ball";
export type DrawingType = "pass-line" | "run-path" | "dribble-path" | "guide-line";

export type ElementType = PlayerType | EquipmentType | DrawingType;

export interface BoardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation?: number;
  /** Spielernummer (optional) */
  number?: number;
  /** Skalierung (1 = 100 %); Ball standardmäßig kleiner */
  scale?: number;
  /** Farbe (z. B. Hütchen) als Hex-Wert */
  color?: string;
  points?: number[];
}

export type KeyframeSpeed = "slow" | "normal" | "fast";

export const KEYFRAME_SPEED_LABELS: Record<KeyframeSpeed, string> = {
  slow: "Langsam",
  normal: "Normal",
  fast: "Schnell",
};

/** Faktor auf die Auto-Dauer: kleiner = zackiger */
export const KEYFRAME_SPEED_MULTIPLIER: Record<KeyframeSpeed, number> = {
  slow: 1.3,
  normal: 0.8,
  fast: 0.4,
};

export const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export const PLAYBACK_RATE_LABELS: Record<PlaybackRate, string> = {
  0.5: "0.5x",
  1: "1x",
  1.5: "1.5x",
  2: "2x",
};

export interface Keyframe {
  id: string;
  label: string;
  elements: BoardElement[];
  /** Tempo der Animation von diesem Schritt zum nächsten */
  speed?: KeyframeSpeed;
}

export interface TacticsBoardDocument {
  id?: string;
  exerciseId?: string;
  name: string;
  keyframes: Keyframe[];
  fieldWidth: number;
  fieldHeight: number;
  fieldView?: FieldView;
  fieldRotation?: FieldRotation;
  updatedAt?: string;
}

export type ToolMode = "select" | ElementType;

export const ROTATABLE_TYPES: ReadonlySet<ElementType> = new Set([
  "mini-goal",
  "big-goal",
  "hurdle",
  "cone",
]);

export function isRotatable(type: ElementType): boolean {
  return ROTATABLE_TYPES.has(type);
}

const LINE_TYPES = new Set<ElementType>(["pass-line", "run-path", "dribble-path", "guide-line"]);
const NUMBER_TYPES = new Set<ElementType>([
  "player-a",
  "player-b",
  "player-c",
  "player-d",
  "player-gk",
]);
const PLAYER_TYPES = new Set<ElementType>([
  "player-a",
  "player-b",
  "player-c",
  "player-d",
  "player-gk",
]);

export const DEFAULT_BALL_SCALE = 0.55;
export const DEFAULT_PLAYER_SCALE_PERCENT = 100;
export const DEFAULT_CONE_COLOR = "#f97316";

export const CONE_COLOR_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Orange", value: "#f97316" },
  { label: "Gelb", value: "#eab308" },
  { label: "Blau", value: "#3b82f6" },
  { label: "Rot", value: "#ef4444" },
  { label: "Weiß", value: "#f8fafc" },
];

export function isPlayerType(type: ElementType): boolean {
  return PLAYER_TYPES.has(type);
}

export function getDefaultScale(type: ElementType): number {
  return type === "ball" ? DEFAULT_BALL_SCALE : 1;
}

export function getElementScale(element: BoardElement): number {
  return element.scale ?? getDefaultScale(element.type);
}

export function elementHasNumber(type: ElementType): boolean {
  return NUMBER_TYPES.has(type);
}

export function elementSupportsScale(type: ElementType): boolean {
  return !LINE_TYPES.has(type);
}

export interface InterpolatedElement extends BoardElement {
  opacity: number;
}

export function cloneElements(elements: BoardElement[]): BoardElement[] {
  return elements.map((el) => ({
    ...el,
    points: el.points ? [...el.points] : undefined,
  }));
}

/** Skaliert Element-Koordinaten relativ von einem Feldmaß auf ein anderes (prozentual). */
export function scaleBoardElement(
  element: BoardElement,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
): BoardElement {
  if (fromW <= 0 || fromH <= 0 || (fromW === toW && fromH === toH)) {
    return { ...element, points: element.points ? [...element.points] : undefined };
  }
  const sx = toW / fromW;
  const sy = toH / fromH;
  const sizeFactor = Math.sqrt(sx * sy);
  const prevScale =
    element.scale ?? (element.type === "ball" ? DEFAULT_BALL_SCALE : 1);
  return {
    ...element,
    x: element.x * sx,
    y: element.y * sy,
    scale: LINE_TYPES.has(element.type) ? element.scale : prevScale * sizeFactor,
    points: element.points
      ? element.points.map((v, i) => (i % 2 === 0 ? v * sx : v * sy))
      : undefined,
  };
}

export function scaleBoardElements(
  elements: BoardElement[],
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
): BoardElement[] {
  return elements.map((el) => scaleBoardElement(el, fromW, fromH, toW, toH));
}

/**
 * Stellt das FIFA-Feldmaß (1050×680) wieder her.
 * Falls ein Board fälschlich auf 1920×1080 gestreckt wurde, werden
 * Positionen/Größen proportional zurückgerechnet — ohne Drehung.
 */
export function migrateDocumentToCurrentField(doc: TacticsBoardDocument): TacticsBoardDocument {
  const fromW = doc.fieldWidth || FIELD_WIDTH;
  const fromH = doc.fieldHeight || FIELD_HEIGHT;
  if (fromW === FIELD_WIDTH && fromH === FIELD_HEIGHT) {
    return { ...doc, fieldWidth: FIELD_WIDTH, fieldHeight: FIELD_HEIGHT };
  }
  return {
    ...doc,
    fieldWidth: FIELD_WIDTH,
    fieldHeight: FIELD_HEIGHT,
    keyframes: doc.keyframes.map((kf) => ({
      ...kf,
      elements: scaleBoardElements(kf.elements, fromW, fromH, FIELD_WIDTH, FIELD_HEIGHT),
    })),
  };
}

export function deepCloneKeyframe(keyframe: Keyframe): Keyframe {
  return {
    ...keyframe,
    elements: cloneElements(keyframe.elements),
  };
}

/** Lineare Interpolation zwischen zwei Keyframes (t: 0..1) */
export function interpolateElements(
  from: BoardElement[],
  to: BoardElement[],
  t: number,
): InterpolatedElement[] {
  const toMap = new Map(to.map((el) => [el.id, el]));
  const fromIds = new Set(from.map((el) => el.id));

  const result: InterpolatedElement[] = from.map((fromEl) => {
    const toEl = toMap.get(fromEl.id);
    if (!toEl) {
      return { ...fromEl, opacity: 1 - t };
    }
    return interpolatePair(fromEl, toEl, t);
  });

  to.forEach((toEl) => {
    if (!fromIds.has(toEl.id)) {
      result.push({ ...toEl, opacity: t });
    }
  });

  return result;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

export function createEmptyKeyframe(index: number): Keyframe {
  return {
    id: createId(),
    label: `Schritt ${index}`,
    elements: [],
    speed: "normal",
  };
}

export function getKeyframeSpeed(keyframe: Keyframe): KeyframeSpeed {
  return keyframe.speed ?? "normal";
}

/** Feld: 1050 Einheiten ≈ 105 m → 10 Einheiten = 1 m */
const UNITS_PER_METER = 10;

/**
 * Referenztempo für die automatische Schritt-Dauer.
 * ~10 m/s (zügiger Lauf) statt Trab — Basiszeit damit ca. 45 % kürzer.
 */
const REFERENCE_SPEED_UNITS_PER_S = 10 * UNITS_PER_METER;

export const MIN_SEGMENT_MS = 220;
export const MAX_SEGMENT_MS = 18000;
const ROTATE_MS_PER_90 = 320;

function elementTravelDistance(fromEl: BoardElement, toEl: BoardElement): number {
  let dist = Math.hypot(toEl.x - fromEl.x, toEl.y - fromEl.y);
  if (fromEl.points && toEl.points && fromEl.points.length === toEl.points.length) {
    for (let i = 0; i < fromEl.points.length; i += 2) {
      const d = Math.hypot(
        (toEl.points[i] ?? 0) - (fromEl.points[i] ?? 0),
        (toEl.points[i + 1] ?? 0) - (fromEl.points[i + 1] ?? 0),
      );
      dist = Math.max(dist, d);
    }
  }
  return dist;
}

function angleDelta(a: number, b: number): number {
  let diff = Math.abs(b - a) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function maxTravelDistance(from: BoardElement[], to: BoardElement[]): number {
  const toMap = new Map(to.map((el) => [el.id, el]));
  let maxDist = 0;
  for (const fromEl of from) {
    const toEl = toMap.get(fromEl.id);
    if (!toEl) continue;
    maxDist = Math.max(maxDist, elementTravelDistance(fromEl, toEl));
  }
  return maxDist;
}

function maxRotationDelta(from: BoardElement[], to: BoardElement[]): number {
  const toMap = new Map(to.map((el) => [el.id, el]));
  let maxRot = 0;
  for (const fromEl of from) {
    const toEl = toMap.get(fromEl.id);
    if (!toEl) continue;
    maxRot = Math.max(maxRot, angleDelta(fromEl.rotation ?? 0, toEl.rotation ?? 0));
  }
  return maxRot;
}

export interface SegmentTiming {
  durationMs: number;
}

/** Einheitliche Schritt-Dauer: Auto aus max. Distanz, dann Langsam/Normal/Schnell */
export function getSegmentTiming(from: Keyframe, to: Keyframe): SegmentTiming {
  const speedFactor = KEYFRAME_SPEED_MULTIPLIER[getKeyframeSpeed(from)];
  const travelMs = (maxTravelDistance(from.elements, to.elements) / REFERENCE_SPEED_UNITS_PER_S) * 1000;
  const rotateMs = (maxRotationDelta(from.elements, to.elements) / 90) * ROTATE_MS_PER_90;
  const autoMs = Math.max(travelMs, rotateMs, MIN_SEGMENT_MS);
  const durationMs = Math.min(MAX_SEGMENT_MS, Math.max(MIN_SEGMENT_MS, autoMs * speedFactor));
  return { durationMs };
}

export function getPlaybackPlan(keyframes: Keyframe[]): { timings: SegmentTiming[]; totalMs: number } {
  const timings: SegmentTiming[] = [];
  let totalMs = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const timing = getSegmentTiming(keyframes[i], keyframes[i + 1]);
    timings.push(timing);
    totalMs += timing.durationMs;
  }
  return { timings, totalMs };
}

/**
 * Interpolation mit gemeinsamer Schritt-Zeit: alle Objekte starten und kommen
 * gleichzeitig an (t identisch für jedes Element).
 */
export function interpolateElementsTimed(
  from: BoardElement[],
  to: BoardElement[],
  elapsedMs: number,
  timing: SegmentTiming,
): InterpolatedElement[] {
  const toMap = new Map(to.map((el) => [el.id, el]));
  const fromIds = new Set(from.map((el) => el.id));
  const t = Math.min(1, Math.max(0, elapsedMs / Math.max(timing.durationMs, 1)));

  const result: InterpolatedElement[] = from.map((fromEl) => {
    const toEl = toMap.get(fromEl.id);
    if (!toEl) {
      return { ...fromEl, opacity: 1 - t };
    }
    return interpolatePair(fromEl, toEl, t);
  });

  to.forEach((toEl) => {
    if (!fromIds.has(toEl.id)) {
      result.push({ ...toEl, opacity: t });
    }
  });

  return result;
}

function interpolatePair(fromEl: BoardElement, toEl: BoardElement, t: number): InterpolatedElement {
  if (fromEl.points && toEl.points && fromEl.points.length === toEl.points.length) {
    const points = fromEl.points.map((v, i) => v + (toEl.points![i] - v) * t);
    return {
      ...fromEl,
      x: fromEl.x + (toEl.x - fromEl.x) * t,
      y: fromEl.y + (toEl.y - fromEl.y) * t,
      rotation: lerpAngle(fromEl.rotation ?? 0, toEl.rotation ?? 0, t),
      scale: getElementScale(fromEl) + (getElementScale(toEl) - getElementScale(fromEl)) * t,
      points,
      opacity: 1,
    };
  }

  return {
    ...fromEl,
    x: fromEl.x + (toEl.x - fromEl.x) * t,
    y: fromEl.y + (toEl.y - fromEl.y) * t,
    rotation: lerpAngle(fromEl.rotation ?? 0, toEl.rotation ?? 0, t),
    scale: getElementScale(fromEl) + (getElementScale(toEl) - getElementScale(fromEl)) * t,
    opacity: 1,
  };
}
