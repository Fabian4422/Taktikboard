import { FIELD_HEIGHT, FIELD_WIDTH, type FieldRotation, type FieldView } from "./types";

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

/** Halbes Feld / Strafraum: Tor liegt oben (90°), Nutzer-Rotation kommt dazu. */
export function getViewBaseRotation(view: FieldView): FieldRotation {
  if (view === "half" || view === "half-blank" || view === "penalty") return 90;
  return 0;
}

/** Ob FIFA-Feldlinien gezeichnet werden (nicht bei freien/blanken Flächen). */
export function showsFieldLines(view: FieldView): boolean {
  return view !== "free" && view !== "half-blank";
}

/** Rasenstreifen nur bei blanken Halbfeld-Ansichten ausblenden – ruhigere Fläche. */
export function showsFieldStripes(view: FieldView): boolean {
  return view !== "half-blank";
}

export function getEffectiveRotation(view: FieldView, userRotation: FieldRotation): FieldRotation {
  return ((getViewBaseRotation(view) + userRotation) % 360) as FieldRotation;
}

export function getRotatedViewportSize(viewport: FieldViewport, rotation: FieldRotation) {
  if (rotation === 90 || rotation === 270) {
    return { w: viewport.h, h: viewport.w };
  }
  return { w: viewport.w, h: viewport.h };
}

export function nextFieldRotation(current: FieldRotation): FieldRotation {
  return ((current + 90) % 360) as FieldRotation;
}

export const FIELD_VIEW_LABELS: Record<FieldView, string> = {
  full: "Ganzes Feld",
  half: "Halbes Feld",
  "half-blank": "Halbfeld blank",
  penalty: "Strafraum",
  free: "Freie Fläche",
};
