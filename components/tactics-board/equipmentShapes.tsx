"use client";

import { Circle, Ellipse, Group, Line, Rect } from "react-konva";
import type Konva from "konva";
import {
  BALL_CENTER_PENTAGON,
  BALL_HEXAGONS,
  BALL_OUTER_PENTAGONS,
  BALL_RADIUS,
  BALL_SEAMS,
  BIG_GOAL,
  HURDLE,
  MINI_GOAL,
  type GoalGeometry,
} from "@/lib/tactics-board/equipmentGeometry";

const deco = {
  listening: false,
  perfectDrawEnabled: false,
  shadowForStrokeEnabled: false,
} as const;

export function SoccerBallIcon({ selected }: { selected: boolean }) {
  return (
    <Group clipFunc={(ctx: Konva.Context) => ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2)}>
      <Circle
        radius={BALL_RADIUS}
        fillRadialGradientStartPoint={{ x: -4, y: -5 }}
        fillRadialGradientStartRadius={1}
        fillRadialGradientEndPoint={{ x: 0, y: 0 }}
        fillRadialGradientEndRadius={BALL_RADIUS}
        fillRadialGradientColorStops={[0, "#ffffff", 0.55, "#f1f5f9", 1, "#cbd5e1"]}
        {...deco}
      />
      <Line points={BALL_CENTER_PENTAGON} closed fill="#0f172a" {...deco} />
      {BALL_OUTER_PENTAGONS.map((pts, i) => (
        <Line key={`op-${i}`} points={pts} closed fill="#0f172a" {...deco} />
      ))}
      {BALL_HEXAGONS.map((pts, i) => (
        <Line key={`hx-${i}`} points={pts} closed stroke="#1e293b" strokeWidth={0.9} {...deco} />
      ))}
      {BALL_SEAMS.map((pts, i) => (
        <Line key={`sm-${i}`} points={pts} stroke="#334155" strokeWidth={0.7} {...deco} />
      ))}
      <Circle
        radius={BALL_RADIUS}
        fill="transparent"
        stroke={selected ? "#38bdf8" : "#1e293b"}
        strokeWidth={selected ? 2.5 : 1.4}
      />
    </Group>
  );
}

function GoalNet({ geo }: { geo: GoalGeometry }) {
  return (
    <>
      <Line points={geo.netFill} closed fill="rgba(248,250,252,0.18)" {...deco} />
      {geo.netLines.map((pts, i) => (
        <Line
          key={`net-${i}`}
          points={pts}
          stroke="rgba(226,232,240,0.7)"
          strokeWidth={0.7}
          {...deco}
        />
      ))}
    </>
  );
}

export function GoalIcon({
  kind,
  selected,
}: {
  kind: "mini-goal" | "big-goal";
  selected: boolean;
}) {
  const geo = kind === "big-goal" ? BIG_GOAL : MINI_GOAL;
  const postFill = "#f8fafc";
  const postStroke = selected ? "#38bdf8" : "#94a3b8";
  const jointR = kind === "big-goal" ? 3.2 : 2.2;

  return (
    <Group>
      <Rect
        x={-geo.depth}
        y={-geo.halfWidth}
        width={geo.depth}
        height={geo.halfWidth * 2}
        fill="rgba(15,23,42,0.16)"
        {...deco}
      />
      <GoalNet geo={geo} />
      {geo.frameLines.map((line, i) => (
        <Line
          key={`frame-outline-${i}`}
          points={line.points}
          stroke={postStroke}
          strokeWidth={line.width + 1.8}
          lineCap="round"
          lineJoin="round"
          {...deco}
        />
      ))}
      {geo.frameLines.map((line, i) => (
        <Line
          key={`frame-${i}`}
          points={line.points}
          stroke={postFill}
          strokeWidth={line.width}
          lineCap="round"
          lineJoin="round"
          {...deco}
        />
      ))}
      <Circle x={geo.frontLeft.x} y={geo.frontLeft.y} radius={jointR} fill={postFill} stroke={postStroke} strokeWidth={1} {...deco} />
      <Circle x={geo.frontRight.x} y={geo.frontRight.y} radius={jointR} fill={postFill} stroke={postStroke} strokeWidth={1} {...deco} />
      <Circle x={geo.backLeft.x} y={geo.backLeft.y} radius={jointR * 0.75} fill="#e2e8f0" {...deco} />
      <Circle x={geo.backRight.x} y={geo.backRight.y} radius={jointR * 0.75} fill="#e2e8f0" {...deco} />
      {selected && (
        <Line
          points={geo.netFill}
          closed
          stroke="#38bdf8"
          strokeWidth={1.5}
          dash={[5, 4]}
          listening={false}
        />
      )}
      <Line points={geo.netFill} closed fill="transparent" stroke="transparent" strokeWidth={12} />
    </Group>
  );
}

export function HurdleIcon({ selected }: { selected: boolean }) {
  const { halfW, postH, barY, footW, footH, postW, stripeH, stripeCount } = HURDLE;
  const postX = halfW - 4;
  const stripes = Array.from({ length: stripeCount }, (_, i) => i);

  const renderPost = (x: number) => (
    <Group x={x} listening={false}>
      <Rect x={-postW / 2} y={-postH} width={postW} height={postH} fill="#111827" {...deco} />
      {stripes.map((i) =>
        i % 2 === 0 ? (
          <Rect
            key={i}
            x={-postW / 2}
            y={-postH + i * stripeH}
            width={postW}
            height={stripeH}
            fill="#facc15"
            {...deco}
          />
        ) : null,
      )}
      <Rect
        x={-footW / 2}
        y={-footH / 2}
        width={footW}
        height={footH}
        fill="#1f2937"
        cornerRadius={1}
        {...deco}
      />
    </Group>
  );

  return (
    <Group>
      {renderPost(-postX)}
      {renderPost(postX)}
      <Line
        points={[-postX, barY + 6, -postX + 4, barY, postX - 4, barY, postX, barY + 6]}
        stroke="#ea580c"
        strokeWidth={4.2}
        lineCap="round"
        lineJoin="round"
        {...deco}
      />
      <Line
        points={[-postX + 1, barY + 7, -postX + 5, barY + 1.5, postX - 5, barY + 1.5, postX - 1, barY + 7]}
        stroke="#fbbf24"
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        {...deco}
      />
      {selected && (
        <Rect
          x={-halfW - 4}
          y={barY - 6}
          width={(halfW + 4) * 2}
          height={postH - barY + 10}
          stroke="#38bdf8"
          strokeWidth={1.5}
          dash={[5, 4]}
          listening={false}
        />
      )}
      <Rect
        x={-halfW - 4}
        y={barY - 6}
        width={(halfW + 4) * 2}
        height={postH - barY + 10}
        fill="transparent"
      />
    </Group>
  );
}

export function ConeIcon({ selected }: { selected: boolean }) {
  return (
    <Group>
      <Ellipse x={0} y={8} radiusX={10} radiusY={4} fill="rgba(15,23,42,0.25)" {...deco} />
      <Line points={[0, -14, 11, 8, -11, 8]} closed fill="#f97316" {...deco} />
      <Line points={[-5, 1, 5, 1]} stroke="#fdba74" strokeWidth={2.5} {...deco} />
      <Line points={[-3.5, -6, 3.5, -6]} stroke="#fff7ed" strokeWidth={2} {...deco} />
      <Line
        points={[0, -14, 11, 8, -11, 8]}
        closed
        stroke={selected ? "#38bdf8" : "#c2410c"}
        strokeWidth={selected ? 2.2 : 1.4}
        fill="transparent"
      />
    </Group>
  );
}
