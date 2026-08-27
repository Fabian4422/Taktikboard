import type { ElementType } from "@/lib/tactics-board/types";

export const ELEMENT_META: Record<
  ElementType,
  { label: string; color: string; group: "spieler" | "material" | "zeichnen" }
> = {
  "player-a": { label: "Spieler A", color: "#ef4444", group: "spieler" },
  "player-b": { label: "Spieler B", color: "#3b82f6", group: "spieler" },
  "player-gk": { label: "Torwart", color: "#eab308", group: "spieler" },
  cone: { label: "Hütchen", color: "#f97316", group: "material" },
  hurdle: { label: "Hürde", color: "#fbbf24", group: "material" },
  "mini-goal": { label: "Mini-Tor", color: "#ffffff", group: "material" },
  "big-goal": { label: "Großtor", color: "#ffffff", group: "material" },
  ball: { label: "Ball", color: "#ffffff", group: "material" },
  "pass-line": { label: "Passlinie", color: "#f8fafc", group: "zeichnen" },
  "run-path": { label: "Laufweg", color: "#22d3ee", group: "zeichnen" },
  "dribble-path": { label: "Dribbling", color: "#a855f7", group: "zeichnen" },
  "guide-line": { label: "Hilfslinie", color: "#94a3b8", group: "zeichnen" },
};

export function getPlayerRadius(type: ElementType): number {
  return type === "player-gk" ? 16 : 14;
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
