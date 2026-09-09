/** DFB-Draufsicht-Geometrie für Trainingsmaterial (Vogelperspektive). */

function regularPolygon(sides: number, radius: number, rotation = -Math.PI / 2): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    pts.push(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  return pts;
}

function translate(points: number[], x: number, y: number): number[] {
  return points.map((v, i) => v + (i % 2 === 0 ? x : y));
}

/** Ball – klassischer Kreis mit Fünf-/Sechseck-Muster */
export const BALL_RADIUS = 12;

const BALL_PENT_R = BALL_RADIUS * 0.3;
const BALL_HEX_R = BALL_RADIUS * 0.28;
const BALL_HEX_DIST = BALL_RADIUS * 0.52;
const BALL_OUTER_PENT_R = BALL_RADIUS * 0.22;
const BALL_OUTER_DIST = BALL_RADIUS * 0.88;

export const BALL_CENTER_PENTAGON = regularPolygon(5, BALL_PENT_R);

export const BALL_HEXAGONS: number[][] = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + Math.PI / 5;
  return translate(regularPolygon(6, BALL_HEX_R, a), Math.cos(a) * BALL_HEX_DIST, Math.sin(a) * BALL_HEX_DIST);
});

export const BALL_OUTER_PENTAGONS: number[][] = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return translate(
    regularPolygon(5, BALL_OUTER_PENT_R, a + Math.PI),
    Math.cos(a) * BALL_OUTER_DIST,
    Math.sin(a) * BALL_OUTER_DIST,
  );
});

export const BALL_SEAMS: number[][] = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const x0 = Math.cos(a) * BALL_PENT_R;
  const y0 = Math.sin(a) * BALL_PENT_R;
  const x1 = Math.cos(a) * BALL_RADIUS * 0.96;
  const y1 = Math.sin(a) * BALL_RADIUS * 0.96;
  return [x0, y0, x1, y1];
});

/** Hütchen – ausgefülltes Dreieck (Draufsicht) */
export const CONE_TRIANGLE = regularPolygon(3, 11, -Math.PI / 2);

/** Slalomstange – Kreis mit Plus (⊕) */
export const POLE = {
  radius: 8,
  plusHalf: 4.5,
  stroke: 1.6,
} as const;

/**
 * Hürde – Draufsicht: dünne Querverbindung mit zwei Standfüßen an den Enden.
 * Keine Seitenansicht mit Pfostenhöhe.
 */
export const HURDLE = {
  halfSpan: 18,
  barWidth: 2.2,
  footLen: 9,
  footWidth: 3.2,
} as const;

/** Freistoßdummy – Oval mit Schulterkontur */
export const DUMMY = {
  bodyRx: 7,
  bodyRy: 11,
  shoulderRx: 11,
  shoulderRy: 4.5,
  shoulderY: -5,
} as const;

export interface GoalGeometry {
  halfWidth: number;
  depth: number;
  postWidth: number;
  netCols: number;
  netRows: number;
  /** Öffnung zeigt in +X (zum Spielfeld), Netz nach −X */
  frontLeft: { x: number; y: number };
  frontRight: { x: number; y: number };
  backLeft: { x: number; y: number };
  backRight: { x: number; y: number };
  netFill: number[];
  netLines: number[][];
  /** Rechteck-Rahmen: Toröffnung + drei Netzwände */
  frameLines: { points: number[]; width: number }[];
  /** Trefferfläche für Hit-Testing */
  hitRect: { x: number; y: number; w: number; h: number };
}

function buildGoalGeometry(kind: "mini-goal" | "big-goal"): GoalGeometry {
  const isBig = kind === "big-goal";
  const halfWidth = isBig ? 36 : 18;
  const depth = isBig ? 22 : 12;
  const postWidth = isBig ? 2.8 : 2.1;
  const netCols = isBig ? 5 : 3;
  const netRows = isBig ? 4 : 3;

  // Öffnung bei x=0 (Blick zum Feld / +X), Netz nach hinten (−X)
  const frontLeft = { x: 0, y: -halfWidth };
  const frontRight = { x: 0, y: halfWidth };
  const backLeft = { x: -depth, y: -halfWidth };
  const backRight = { x: -depth, y: halfWidth };

  const netFill = [
    frontLeft.x,
    frontLeft.y,
    frontRight.x,
    frontRight.y,
    backRight.x,
    backRight.y,
    backLeft.x,
    backLeft.y,
  ];

  const netLines: number[][] = [];
  for (let i = 1; i < netCols; i++) {
    const t = i / netCols;
    // leicht konvergierend nach hinten für Tiefenwirkung
    const inset = halfWidth * 0.08 * t;
    netLines.push([
      -depth * t,
      -halfWidth + inset,
      -depth * t,
      halfWidth - inset,
    ]);
  }
  for (let j = 1; j < netRows; j++) {
    const t = j / netRows;
    netLines.push([
      0,
      -halfWidth + (halfWidth * 2) * t,
      -depth,
      -halfWidth + (halfWidth * 2) * t,
    ]);
  }

  const frameLines = [
    // Toröffnung (Blickrichtung Feld)
    { points: [frontLeft.x, frontLeft.y, frontRight.x, frontRight.y], width: postWidth },
    { points: [frontLeft.x, frontLeft.y, backLeft.x, backLeft.y], width: postWidth * 0.9 },
    { points: [frontRight.x, frontRight.y, backRight.x, backRight.y], width: postWidth * 0.9 },
    { points: [backLeft.x, backLeft.y, backRight.x, backRight.y], width: postWidth * 0.85 },
  ];

  return {
    halfWidth,
    depth,
    postWidth,
    netCols,
    netRows,
    frontLeft,
    frontRight,
    backLeft,
    backRight,
    netFill,
    netLines,
    frameLines,
    hitRect: { x: -depth, y: -halfWidth, w: depth, h: halfWidth * 2 },
  };
}

export const BIG_GOAL = buildGoalGeometry("big-goal");
export const MINI_GOAL = buildGoalGeometry("mini-goal");
