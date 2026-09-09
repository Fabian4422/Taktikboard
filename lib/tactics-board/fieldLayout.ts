import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  scaleBoardElements,
  type BoardElement,
  type FieldRotation,
  type FieldView,
  type TacticsBoardDocument,
} from "./types";

export interface FieldViewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FIELD_PAD = 30;
/** FIFA-Standardlänge / -breite in Metern */
const PITCH_LENGTH_M = 105;
const PITCH_WIDTH_M = 68;

export function getFieldLayout() {
  const pad = FIELD_PAD;
  const fw = FIELD_WIDTH - pad * 2;
  const fh = FIELD_HEIGHT - pad * 2;
  const px = fw / PITCH_LENGTH_M;
  const py = fh / PITCH_WIDTH_M;

  return {
    pad,
    fw,
    fh,
    px,
    py,
    cx: FIELD_WIDTH / 2,
    cy: FIELD_HEIGHT / 2,
    left: pad,
    right: pad + fw,
    top: pad,
    bottom: pad + fh,
    penaltyW: 16.5 * px,
    penaltyH: 40.32 * py,
    goalAreaW: 5.5 * px,
    goalAreaH: 18.32 * py,
    centerR: 9.15 * px,
    goalW: 2.44 * px,
    goalH: 7.32 * py,
    penaltySpotDist: 11 * px,
    penaltyArcR: 9.15 * px,
    cornerR: 1 * px,
    spotR: 3.2,
  };
}

function arcPoints(
  cx: number,
  cy: number,
  radius: number,
  startRad: number,
  endRad: number,
  steps = 32,
): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = startRad + ((endRad - startRad) * i) / steps;
    pts.push(cx + Math.cos(t) * radius, cy + Math.sin(t) * radius);
  }
  return pts;
}

export function getPenaltyArcHalfAngle(layout: ReturnType<typeof getFieldLayout>): number {
  const dx = layout.penaltyW - layout.penaltySpotDist;
  return Math.acos(Math.min(1, Math.max(-1, dx / layout.penaltyArcR)));
}

export function getFieldMarkingArcs() {
  const L = getFieldLayout();
  const a = getPenaltyArcHalfAngle(L);

  return {
    penaltyArcs: [
      arcPoints(L.left + L.penaltySpotDist, L.cy, L.penaltyArcR, -a, a),
      arcPoints(L.right - L.penaltySpotDist, L.cy, L.penaltyArcR, Math.PI - a, Math.PI + a),
    ],
    cornerArcs: [
      arcPoints(L.left, L.top, L.cornerR, 0, Math.PI / 2, 12),
      arcPoints(L.right, L.top, L.cornerR, Math.PI / 2, Math.PI, 12),
      arcPoints(L.right, L.bottom, L.cornerR, Math.PI, (3 * Math.PI) / 2, 12),
      arcPoints(L.left, L.bottom, L.cornerR, (3 * Math.PI) / 2, Math.PI * 2, 12),
    ],
    penaltySpots: [
      { x: L.left + L.penaltySpotDist, y: L.cy },
      { x: L.right - L.penaltySpotDist, y: L.cy },
    ],
  };
}

export function getFieldViewport(view: FieldView): FieldViewport {
  const layout = getFieldLayout();

  if (view === "half" || view === "half-blank") {
    return {
      x: 0,
      y: 0,
      w: layout.cx + 8,
      h: FIELD_HEIGHT,
    };
  }

  if (view === "penalty") {
    const arcReach = layout.penaltySpotDist + layout.penaltyArcR;
    const marginX = 24;
    const marginY = 28;
    return {
      x: layout.left - layout.goalW - marginX,
      y: layout.cy - layout.penaltyH / 2 - marginY,
      w: Math.max(layout.penaltyW, arcReach) + layout.goalW + marginX * 2,
      h: layout.penaltyH + marginY * 2,
    };
  }

  // full + free: gesamtes Spielfeld
  return { x: 0, y: 0, w: FIELD_WIDTH, h: FIELD_HEIGHT };
}

/** Views drehen das Feld nicht — nur die manuelle Nutzer-Rotation (90°-Schritte). */
export function getViewBaseRotation(_view: FieldView): FieldRotation {
  return 0;
}

/** Ob FIFA-Feldlinien gezeichnet werden (nicht bei freien/blanken Flächen). */
export function showsFieldLines(view: FieldView): boolean {
  return view !== "free" && view !== "half-blank";
}

/** Rasenstreifen auf allen Ansichten – auch Halbfeld blank (Tiefe ohne Feldlinien). */
export function showsFieldStripes(_view: FieldView): boolean {
  return true;
}

/**
 * Effektive Canvas-Drehung: nur manuelle fieldRotation (Rasen/Linien).
 * Objekt-Koordinaten liegen im starren Viewport-Raum (X rechts, Y unten).
 */
export function getEffectiveRotation(_view: FieldView, userRotation: FieldRotation): FieldRotation {
  return userRotation;
}

export function getRotatedViewportSize(viewport: FieldViewport, rotation: FieldRotation) {
  if (rotation === 90 || rotation === 270) {
    return { w: viewport.h, h: viewport.w };
  }
  return { w: viewport.w, h: viewport.h };
}

/** 90° im Uhrzeigersinn. */
export function nextFieldRotation(current: FieldRotation): FieldRotation {
  return ((current + 90) % 360) as FieldRotation;
}

/** Winkel in [0, 360) normalisieren. */
export function normalizeDegrees(degrees: number): number {
  const n = degrees % 360;
  return n < 0 ? n + 360 : n;
}

/**
 * Früher: Element-Rotation im Feldraum für Viewport-Aufrecht.
 * Objekte liegen jetzt im Viewport-Raum → Aufrecht = 0°.
 */
export function viewportUprightElementRotation(_fieldRotation: FieldRotation): number {
  return 0;
}

/**
 * Feldraum → Viewport-Raum (starr am Bildschirm, X rechts / Y unten).
 * Entspricht der früheren Konva-CW-Rotation um den Viewport-Mittelpunkt.
 */
export function fieldPointToViewport(
  fx: number,
  fy: number,
  viewport: FieldViewport,
  rotation: FieldRotation,
): { x: number; y: number } {
  const rotated = getRotatedViewportSize(viewport, rotation);
  const dx = fx - (viewport.x + viewport.w / 2);
  const dy = fy - (viewport.y + viewport.h / 2);
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Canvas/Konva (y-down): positive Winkel = Uhrzeigersinn
  return {
    x: rotated.w / 2 + dx * cos - dy * sin,
    y: rotated.h / 2 + dx * sin + dy * cos,
  };
}

/** Viewport-Raum → Feldraum (Inverse von fieldPointToViewport). */
export function viewportPointToField(
  vx: number,
  vy: number,
  viewport: FieldViewport,
  rotation: FieldRotation,
): { x: number; y: number } {
  const rotated = getRotatedViewportSize(viewport, rotation);
  const dx = vx - rotated.w / 2;
  const dy = vy - rotated.h / 2;
  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: viewport.x + viewport.w / 2 + dx * cos - dy * sin,
    y: viewport.y + viewport.h / 2 + dx * sin + dy * cos,
  };
}

export function fieldElementToViewport(
  element: { x: number; y: number; points?: number[]; rotation?: number },
  viewport: FieldViewport,
  rotation: FieldRotation,
): { x: number; y: number; points?: number[]; rotation?: number } {
  const pos = fieldPointToViewport(element.x, element.y, viewport, rotation);
  let points: number[] | undefined;
  if (element.points && element.points.length >= 2) {
    points = [];
    for (let i = 0; i < element.points.length; i += 2) {
      const p = fieldPointToViewport(element.points[i], element.points[i + 1], viewport, rotation);
      points.push(p.x, p.y);
    }
  }
  // Icon-Rotation war relativ zum Feldraum; im Viewport: Feldrotation herausrechnen
  const nextRotation =
    element.rotation != null ? normalizeDegrees(element.rotation + rotation) : undefined;
  return { x: pos.x, y: pos.y, points, rotation: nextRotation };
}

export const FIELD_VIEW_LABELS: Record<FieldView, string> = {
  full: "Ganzes Feld",
  half: "Halbes Feld",
  "half-blank": "Halbfeld blank",
  penalty: "Strafraum",
  free: "Freie Fläche",
};

/**
 * Migriert Legacy-Feldraum-Koordinaten in den starren Viewport-Raum
 * und stellt ggf. das FIFA-Feldmaß wieder her.
 */
export function migrateTacticsDocument(doc: TacticsBoardDocument): TacticsBoardDocument {
  let next: TacticsBoardDocument = { ...doc };

  const fromW = next.fieldWidth || FIELD_WIDTH;
  const fromH = next.fieldHeight || FIELD_HEIGHT;
  if (fromW !== FIELD_WIDTH || fromH !== FIELD_HEIGHT) {
    next = {
      ...next,
      fieldWidth: FIELD_WIDTH,
      fieldHeight: FIELD_HEIGHT,
      keyframes: next.keyframes.map((kf) => ({
        ...kf,
        elements: scaleBoardElements(kf.elements, fromW, fromH, FIELD_WIDTH, FIELD_HEIGHT),
      })),
    };
  } else {
    next = { ...next, fieldWidth: FIELD_WIDTH, fieldHeight: FIELD_HEIGHT };
  }

  if (next.coordSpace === "viewport") {
    return next;
  }

  const fieldView = next.fieldView ?? "full";
  const rotation = getEffectiveRotation(fieldView, next.fieldRotation ?? 90);
  const viewport = getFieldViewport(fieldView);

  return {
    ...next,
    coordSpace: "viewport",
    keyframes: next.keyframes.map((kf) => ({
      ...kf,
      elements: kf.elements.map((el) => {
        const converted = fieldElementToViewport(el, viewport, rotation);
        return {
          ...el,
          x: converted.x,
          y: converted.y,
          points: converted.points,
          rotation: converted.rotation ?? el.rotation,
        } satisfies BoardElement;
      }),
    })),
  };
}
