"use client";

import { Circle, Ellipse, Group, Line, Rect } from "react-konva";
import {
  BALL_CENTER_PENTAGON,
  BALL_HEXAGONS,
  BALL_OUTER_PENTAGONS,
  BALL_RADIUS,
  BALL_SEAMS,
  BIG_GOAL,
  CONE_TRIANGLE,
  DUMMY,
  HURDLE,
  MINI_GOAL,
  POLE,
  type GoalGeometry,
} from "@/lib/tactics-board/equipmentGeometry";

const deco = {
  listening: false,
  perfectDrawEnabled: false,
  shadowForStrokeEnabled: false,
} as const;

function getMaterialPalette(color: string) {
  switch (color.toLowerCase()) {
    case "#eab308":
      return { fill: "#eab308", stroke: "#a16207" };
    case "#3b82f6":
      return { fill: "#3b82f6", stroke: "#1d4ed8" };
    case "#ef4444":
      return { fill: "#ef4444", stroke: "#b91c1c" };
    case "#f8fafc":
      return { fill: "#f8fafc", stroke: "#64748b" };
    case "#22c55e":
      return { fill: "#22c55e", stroke: "#15803d" };
    case "#f97316":
    default:
      return { fill: "#f97316", stroke: "#c2410c" };
  }
}

/** Ball – DFB-Draufsicht mit klassischem Fünf-/Sechseck-Muster */
export function SoccerBallIcon({ selected }: { selected: boolean }) {
  return (
    <Group>
      <Circle radius={BALL_RADIUS} fill="#f8fafc" {...deco} />
      <Line points={BALL_CENTER_PENTAGON} closed fill="#0f172a" {...deco} />
      {BALL_OUTER_PENTAGONS.map((pts, i) => (
        <Line key={`op-${i}`} points={pts} closed fill="#0f172a" {...deco} />
      ))}
      {BALL_HEXAGONS.map((pts, i) => (
        <Line key={`hx-${i}`} points={pts} closed stroke="#1e293b" strokeWidth={0.85} {...deco} />
      ))}
      {BALL_SEAMS.map((pts, i) => (
        <Line key={`sm-${i}`} points={pts} stroke="#334155" strokeWidth={0.65} {...deco} />
      ))}
      <Circle
        radius={BALL_RADIUS}
        fill="transparent"
        stroke={selected ? "#38bdf8" : "#1e293b"}
        strokeWidth={selected ? 2.4 : 1.3}
      />
    </Group>
  );
}

function GoalNet({ geo }: { geo: GoalGeometry }) {
  return (
    <>
      <Line points={geo.netFill} closed fill="rgba(248,250,252,0.14)" {...deco} />
      {geo.netLines.map((pts, i) => (
        <Line
          key={`net-${i}`}
          points={pts}
          stroke="rgba(226,232,240,0.75)"
          strokeWidth={0.65}
          {...deco}
        />
      ))}
    </>
  );
}

/** Tor – Rechteck-Kontur, Netz nach hinten, Öffnung zum Feld (+X) */
export function GoalIcon({
  kind,
  selected,
}: {
  kind: "mini-goal" | "big-goal";
  selected: boolean;
}) {
  const geo = kind === "big-goal" ? BIG_GOAL : MINI_GOAL;
  const stroke = selected ? "#38bdf8" : "#e2e8f0";
  const postFill = "#f8fafc";

  return (
    <Group>
      <GoalNet geo={geo} />
      {geo.frameLines.map((line, i) => (
        <Line
          key={`frame-outline-${i}`}
          points={line.points}
          stroke={selected ? "#0ea5e9" : "#64748b"}
          strokeWidth={line.width + 1.4}
          lineCap="square"
          lineJoin="miter"
          {...deco}
        />
      ))}
      {geo.frameLines.map((line, i) => (
        <Line
          key={`frame-${i}`}
          points={line.points}
          stroke={i === 0 ? postFill : stroke}
          strokeWidth={line.width}
          lineCap="square"
          lineJoin="miter"
          {...deco}
        />
      ))}
      {/* Öffnungs-Markierung (stärkere Linie zum Feld) */}
      <Line
        points={[geo.frontLeft.x, geo.frontLeft.y, geo.frontRight.x, geo.frontRight.y]}
        stroke={postFill}
        strokeWidth={geo.postWidth + 0.6}
        lineCap="square"
        {...deco}
      />
      <Rect
        x={geo.hitRect.x}
        y={geo.hitRect.y}
        width={geo.hitRect.w}
        height={geo.hitRect.h}
        fill="transparent"
      />
    </Group>
  );
}

/** Hürde – Querverbindung mit zwei Standfüßen (Draufsicht) */
export function HurdleIcon({ selected }: { selected: boolean }) {
  const { halfSpan, barWidth, footLen, footWidth } = HURDLE;
  const stroke = selected ? "#38bdf8" : "#1e293b";
  const fill = "#facc15";

  return (
    <Group>
      <Line
        points={[-halfSpan, 0, halfSpan, 0]}
        stroke={stroke}
        strokeWidth={barWidth + (selected ? 1.2 : 0)}
        lineCap="round"
        {...deco}
      />
      <Line
        points={[-halfSpan, 0, halfSpan, 0]}
        stroke={fill}
        strokeWidth={barWidth}
        lineCap="round"
        {...deco}
      />
      <Rect
        x={-halfSpan - footWidth / 2}
        y={-footLen / 2}
        width={footWidth}
        height={footLen}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2}
        cornerRadius={1}
      />
      <Rect
        x={halfSpan - footWidth / 2}
        y={-footLen / 2}
        width={footWidth}
        height={footLen}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2}
        cornerRadius={1}
      />
    </Group>
  );
}

/** Hütchen – ausgefülltes Dreieck in Materialfarbe (DFB-Draufsicht) */
export function ConeIcon({
  selected,
  color = "#f97316",
}: {
  selected: boolean;
  color?: string;
}) {
  const palette = getMaterialPalette(color);
  return (
    <Group>
      <Line
        points={CONE_TRIANGLE}
        closed
        fill={palette.fill}
        stroke={selected ? "#38bdf8" : palette.stroke}
        strokeWidth={selected ? 2.2 : 1.4}
      />
    </Group>
  );
}

/** Slalomstange – kleiner Kreis mit zentralem Pluszeichen (⊕) */
export function PoleIcon({ selected }: { selected: boolean }) {
  const { radius, plusHalf, stroke } = POLE;
  const ink = selected ? "#38bdf8" : "#0f172a";
  return (
    <Group>
      <Circle
        radius={radius}
        fill="#f8fafc"
        stroke={ink}
        strokeWidth={selected ? 2.2 : stroke}
      />
      <Line
        points={[-plusHalf, 0, plusHalf, 0]}
        stroke={ink}
        strokeWidth={stroke}
        lineCap="round"
        {...deco}
      />
      <Line
        points={[0, -plusHalf, 0, plusHalf]}
        stroke={ink}
        strokeWidth={stroke}
        lineCap="round"
        {...deco}
      />
    </Group>
  );
}

/** Freistoßdummy – Oval mit Schulterkontur */
export function DummyIcon({
  selected,
  color = "#eab308",
}: {
  selected: boolean;
  color?: string;
}) {
  const palette = getMaterialPalette(color);
  const stroke = selected ? "#38bdf8" : palette.stroke;
  return (
    <Group>
      <Ellipse
        radiusX={DUMMY.bodyRx}
        radiusY={DUMMY.bodyRy}
        fill={palette.fill}
        stroke={stroke}
        strokeWidth={selected ? 2.2 : 1.4}
      />
      <Ellipse
        y={DUMMY.shoulderY}
        radiusX={DUMMY.shoulderRx}
        radiusY={DUMMY.shoulderRy}
        fill={palette.fill}
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.2}
      />
      {/* Kopfandeutung (kleine Kreisfläche oben) */}
      <Circle
        y={-DUMMY.bodyRy + 1}
        radius={3.2}
        fill={palette.fill}
        stroke={stroke}
        strokeWidth={1.1}
        {...deco}
      />
    </Group>
  );
}
