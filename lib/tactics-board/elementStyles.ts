import type { ElementType } from "@/lib/tactics-board/types";

export const ELEMENT_META: Record<
  ElementType,
  { label: string; color: string; group: "spieler" | "material" | "zeichnen" }
> = {
  "player-a": { label: "Spieler A (Rot)", color: "#ef4444", group: "spieler" },
  "player-b": { label: "Spieler B (Blau)", color: "#3b82f6", group: "spieler" },
  "player-c": { label: "Spieler C (Grün)", color: "#22c55e", group: "spieler" },
  "player-d": { label: "Spieler D (Lila)", color: "#a855f7", group: "spieler" },
  "player-gk": { label: "Torwart", color: "#eab308", group: "spieler" },
  cone: { label: "Hütchen", color: "#f97316", group: "material" },
  pole: { label: "Slalomstange", color: "#f8fafc", group: "material" },
  hurdle: { label: "Hürde", color: "#facc15", group: "material" },
  "agility-ladder": { label: "Koordinationsleiter", color: "#facc15", group: "material" },
  dummy: { label: "Freistoßdummy", color: "#eab308", group: "material" },
  "mini-goal": { label: "Mini-Tor", color: "#ffffff", group: "material" },
  "big-goal": { label: "Großtor", color: "#ffffff", group: "material" },
  ball: { label: "Ball", color: "#ffffff", group: "material" },
  "pass-line": { label: "Passlinie", color: "#f8fafc", group: "zeichnen" },
  "run-path": { label: "Laufweg", color: "#22d3ee", group: "zeichnen" },
  "dribble-path": { label: "Dribbling", color: "#a855f7", group: "zeichnen" },
  "guide-line": { label: "Hilfslinie", color: "#94a3b8", group: "zeichnen" },
  "text-box": { label: "Textfeld", color: "#f8fafc", group: "zeichnen" },
};

export function getPlayerRadius(type: ElementType): number {
  return type === "player-gk" ? 16 : 14;
}

export type LineGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Kontrollpunkt für gekrümmte Linien (optional) */
  cx?: number;
  cy?: number;
  curved: boolean;
};

/** Default-Biegung senkrecht zur Strecke (für Dribbling-Kontrollpunkt). */
export function defaultBendControl(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  distance = 48,
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: (x1 + x2) / 2 - (dy / len) * distance,
    y: (y1 + y2) / 2 + (dx / len) * distance,
  };
}

/**
 * Liest Start-/Endpunkt und optionalen Kontrollpunkt aus points.
 * Format: [x1,y1,x2,y2] oder [x1,y1,cx,cy,x2,y2].
 */
export function parseLineGeometry(points: number[]): LineGeometry | null {
  if (points.length >= 6) {
    return {
      x1: points[0],
      y1: points[1],
      cx: points[2],
      cy: points[3],
      x2: points[4],
      y2: points[5],
      curved: true,
    };
  }
  if (points.length >= 4) {
    return {
      x1: points[0],
      y1: points[1],
      x2: points[2],
      y2: points[3],
      curved: false,
    };
  }
  return null;
}

export function lineGeometryToPoints(geo: LineGeometry): number[] {
  if (geo.curved && geo.cx != null && geo.cy != null) {
    return [geo.x1, geo.y1, geo.cx, geo.cy, geo.x2, geo.y2];
  }
  return [geo.x1, geo.y1, geo.x2, geo.y2];
}

/** Abtastung einer quadratischen Bezier-Kurve. */
export function sampleQuadraticPoints(
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  segments = 28,
): number[] {
  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    points.push(
      u * u * x1 + 2 * u * t * cx + t * t * x2,
      u * u * y1 + 2 * u * t * cy + t * t * y2,
    );
  }
  return points;
}

/** Erzeugt Wellenpunkte für Dribbling-Linien (hohe Schwingungsfrequenz). */
export function buildWavePoints(x1: number, y1: number, x2: number, y2: number): number[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1) return [x1, y1, x2, y2];

  // ~2–3× mehr Wellen: dichtere Segmente und höhere Sinus-Frequenz
  const segments = Math.max(8, Math.floor(length / 7));
  const waves = Math.max(3, Math.round(length / 28));
  const nx = -dy / length;
  const ny = dx / length;
  const amplitude = 7;

  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wave = Math.sin(t * Math.PI * 2 * waves) * amplitude;
    points.push(x1 + dx * t + nx * wave, y1 + dy * t + ny * wave);
  }
  return points;
}

/** Zeichenpunkte für eine Linie (gerade, Welle oder Bezier). */
export function getLineRenderPoints(type: ElementType, points: number[]): number[] {
  const geo = parseLineGeometry(points);
  if (!geo) return points;
  if (geo.curved && geo.cx != null && geo.cy != null) {
    return sampleQuadraticPoints(geo.x1, geo.y1, geo.cx, geo.cy, geo.x2, geo.y2);
  }
  if (type === "dribble-path") {
    return buildWavePoints(geo.x1, geo.y1, geo.x2, geo.y2);
  }
  return [geo.x1, geo.y1, geo.x2, geo.y2];
}

/** Pfeilspitze am Linienende */
export function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size = 12): number[] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI * 0.85;
  const a2 = angle - Math.PI * 0.85;
  return [
    x2, y2,
    x2 + Math.cos(a1) * size, y2 + Math.sin(a1) * size,
    x2, y2,
    x2 + Math.cos(a2) * size, y2 + Math.sin(a2) * size,
  ];
}

/** Tangente am Ende einer optional gekrümmten Linie für die Pfeilspitze. */
export function lineArrowAnchor(geo: LineGeometry): { x1: number; y1: number; x2: number; y2: number } {
  if (geo.curved && geo.cx != null && geo.cy != null) {
    return { x1: geo.cx, y1: geo.cy, x2: geo.x2, y2: geo.y2 };
  }
  return { x1: geo.x1, y1: geo.y1, x2: geo.x2, y2: geo.y2 };
}
