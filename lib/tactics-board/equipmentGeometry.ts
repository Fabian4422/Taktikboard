/** Vorberechnete Geometrie für Spielfeld-Objekte (einmalig, nicht pro Frame). */

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

export const BALL_RADIUS = 13;

const BALL_PENT_R = BALL_RADIUS * 0.32;
const BALL_HEX_R = BALL_RADIUS * 0.3;
const BALL_HEX_DIST = BALL_RADIUS * 0.54;
const BALL_OUTER_PENT_R = BALL_RADIUS * 0.24;
const BALL_OUTER_DIST = BALL_RADIUS * 0.9;

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
  const x1 = Math.cos(a) * BALL_RADIUS * 0.98;
  const y1 = Math.sin(a) * BALL_RADIUS * 0.98;
  return [x0, y0, x1, y1];
});

export interface GoalGeometry {
  halfWidth: number;
  depth: number;
  postWidth: number;
  netCols: number;
  netRows: number;
  frontLeft: { x: number; y: number };
  frontRight: { x: number; y: number };
  backLeft: { x: number; y: number };
  backRight: { x: number; y: number };
  netFill: number[];
  netLines: number[][];
  frameLines: { points: number[]; width: number }[];
}

function buildGoalGeometry(kind: "mini-goal" | "big-goal"): GoalGeometry {
  const isBig = kind === "big-goal";
  const halfWidth = isBig ? 40 : 21;
  const depth = isBig ? 32 : 17;
  const postWidth = isBig ? 3.4 : 2.4;
  const netCols = isBig ? 6 : 4;
  const netRows = isBig ? 5 : 3;

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
    netLines.push([
      frontLeft.x + (backLeft.x - frontLeft.x) * t,
      frontLeft.y + (backLeft.y - frontLeft.y) * t,
      frontRight.x + (backRight.x - frontRight.x) * t,
      frontRight.y + (backRight.y - frontRight.y) * t,
    ]);
  }
  for (let j = 1; j < netRows; j++) {
    const t = j / netRows;
    netLines.push([
      frontLeft.x + (frontRight.x - frontLeft.x) * t,
      frontLeft.y + (frontRight.y - frontLeft.y) * t,
      backLeft.x + (backRight.x - backLeft.x) * t,
      backLeft.y + (backRight.y - backLeft.y) * t,
    ]);
  }

  const frameLines = [
    { points: [frontLeft.x, frontLeft.y, frontRight.x, frontRight.y], width: postWidth },
    { points: [frontLeft.x, frontLeft.y, backLeft.x, backLeft.y], width: postWidth * 0.85 },
    { points: [frontRight.x, frontRight.y, backRight.x, backRight.y], width: postWidth * 0.85 },
    { points: [backLeft.x, backLeft.y, backRight.x, backRight.y], width: postWidth * 0.75 },
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
  };
}

export const BIG_GOAL = buildGoalGeometry("big-goal");
export const MINI_GOAL = buildGoalGeometry("mini-goal");

export const HURDLE = {
  halfW: 22,
  postH: 22,
  barY: -22,
  footW: 10,
  footH: 4,
  postW: 3.2,
  stripeH: 4.4,
  stripeCount: 5,
} as const;
