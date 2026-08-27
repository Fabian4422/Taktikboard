"use client";

import { Layer, Line, Circle, Group, Rect, Stage } from "react-konva";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type Konva from "konva";
import { BoardElementShape } from "./BoardElementShape";
import type { BoardElement, FieldRotation, FieldView, ToolMode } from "@/lib/tactics-board/types";
import { FIELD_HEIGHT, FIELD_WIDTH } from "@/lib/tactics-board/types";
import {
  getEffectiveRotation,
  getFieldLayout,
  getFieldMarkingArcs,
  getFieldViewport,
  getRotatedViewportSize,
  showsFieldLines,
  showsFieldStripes,
} from "@/lib/tactics-board/fieldLayout";

interface FieldCanvasProps {
  width?: number;
  height?: number;
  elements: BoardElement[];
  selectedId: string | null;
  toolMode: ToolMode;
  lineDraft: { x: number; y: number } | null;
  isPlaying: boolean;
  fieldView: FieldView;
  fieldRotation: FieldRotation;
  onSelect: (id: string | null) => void;
  onElementMove: (id: string, x: number, y: number) => void;
  onLineMove: (id: string, dx: number, dy: number) => void;
  onFieldClick: (x: number, y: number) => void;
  onElementTransform?: (id: string, x: number, y: number, rotation: number) => void;
  stageRef?: React.RefObject<Konva.Stage | null>;
  /** Spielfeld in die verfügbare Höhe/Breite einpassen (Vollbild) */
  fillParent?: boolean;
  /** Keine Auswahl/Bearbeitung (Vorschau / Export) */
  preview?: boolean;
  /** Wird nach jedem Konva-Redraw aufgerufen (Export wartet darauf). */
  sceneReadyRef?: React.MutableRefObject<(() => void) | null>;
}

function FootballFieldLines() {
  const {
    cx,
    cy,
    left,
    right,
    top,
    bottom,
    penaltyW,
    penaltyH,
    goalAreaW,
    goalAreaH,
    centerR,
    goalW,
    goalH,
    spotR,
  } = getFieldLayout();
  const { penaltyArcs, cornerArcs, penaltySpots } = getFieldMarkingArcs();

  const lineColor = "rgba(255,255,255,0.9)";
  const lineWidth = 3;

  return (
    <>
      <Line
        points={[left, top, right, top, right, bottom, left, bottom, left, top]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        closed
      />
      <Line points={[cx, top, cx, bottom]} stroke={lineColor} strokeWidth={lineWidth} />
      <Circle x={cx} y={cy} radius={centerR} stroke={lineColor} strokeWidth={lineWidth} />
      <Circle x={cx} y={cy} radius={spotR} fill={lineColor} />

      <Line
        points={[
          left,
          cy - penaltyH / 2,
          left + penaltyW,
          cy - penaltyH / 2,
          left + penaltyW,
          cy + penaltyH / 2,
          left,
          cy + penaltyH / 2,
        ]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        closed
      />
      <Line
        points={[
          right,
          cy - penaltyH / 2,
          right - penaltyW,
          cy - penaltyH / 2,
          right - penaltyW,
          cy + penaltyH / 2,
          right,
          cy + penaltyH / 2,
        ]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        closed
      />
      <Line
        points={[
          left,
          cy - goalAreaH / 2,
          left + goalAreaW,
          cy - goalAreaH / 2,
          left + goalAreaW,
          cy + goalAreaH / 2,
          left,
          cy + goalAreaH / 2,
        ]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        closed
      />
      <Line
        points={[
          right,
          cy - goalAreaH / 2,
          right - goalAreaW,
          cy - goalAreaH / 2,
          right - goalAreaW,
          cy + goalAreaH / 2,
          right,
          cy + goalAreaH / 2,
        ]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        closed
      />

      {penaltyArcs.map((pts, i) => (
        <Line key={`parc-${i}`} points={pts} stroke={lineColor} strokeWidth={lineWidth} lineCap="round" />
      ))}
      {penaltySpots.map((spot, i) => (
        <Circle key={`pspot-${i}`} x={spot.x} y={spot.y} radius={spotR} fill={lineColor} />
      ))}
      {cornerArcs.map((pts, i) => (
        <Line key={`corner-${i}`} points={pts} stroke={lineColor} strokeWidth={lineWidth} lineCap="round" />
      ))}

      <Line
        points={[
          left - goalW,
          cy - goalH / 2,
          left,
          cy - goalH / 2,
          left,
          cy + goalH / 2,
          left - goalW,
          cy + goalH / 2,
        ]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        closed
        fill="rgba(255,255,255,0.15)"
      />
      <Line
        points={[
          right,
          cy - goalH / 2,
          right + goalW,
          cy - goalH / 2,
          right + goalW,
          cy + goalH / 2,
          right,
          cy + goalH / 2,
        ]}
        stroke={lineColor}
        strokeWidth={lineWidth}
        closed
        fill="rgba(255,255,255,0.15)"
      />
    </>
  );
}

export function FieldCanvas({
  width: fallbackWidth = 840,
  elements,
  selectedId,
  toolMode,
  lineDraft,
  isPlaying,
  fieldView,
  fieldRotation,
  onSelect,
  onElementMove,
  onLineMove,
  onFieldClick,
  onElementTransform,
  stageRef: externalRef,
  fillParent = false,
  preview = false,
  sceneReadyRef,
}: FieldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(fallbackWidth);
  const [containerH, setContainerH] = useState(0);
  const internalRef = useRef<Konva.Stage | null>(null);
  const stageRef = externalRef ?? internalRef;
  const fieldGroupRef = useRef<{
    getRelativePointerPosition: () => { x: number; y: number } | null;
  } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth || fallbackWidth;
      const h = el.clientHeight;
      if (w > 0) setContainerW(w);
      if (h > 0) setContainerH(h);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallbackWidth]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.batchDraw();
    sceneReadyRef?.current?.();
  }, [elements, sceneReadyRef, stageRef]);

  const viewport = getFieldViewport(fieldView);
  const rotation = getEffectiveRotation(fieldView, fieldRotation);
  const rotated = getRotatedViewportSize(viewport, rotation);
  const scale =
    fillParent && containerH > 0
      ? Math.min(containerW / rotated.w, containerH / rotated.h)
      : containerW / rotated.w;
  const stageW = fillParent && containerH > 0 ? rotated.w * scale : containerW;
  const stageH = rotated.h * scale;

  const handleStageClick = (e: {
    target: {
      getStage: () => unknown;
      name?: () => string;
      getParent?: () => unknown;
    };
  }) => {
    let node: { name?: () => string; getParent?: () => unknown } | null = e.target;
    const stage = e.target.getStage();
    while (node && node !== stage) {
      if (node.name?.() === "board-element") return;
      node = (node.getParent?.() as typeof node) ?? null;
    }

    onSelect(null);
    if (preview || isPlaying) return;
    if (toolMode !== "select" && !isPlaying) {
      const pointer = fieldGroupRef.current?.getRelativePointerPosition();
      if (!pointer) return;
      onFieldClick(pointer.x, pointer.y);
    }
  };

  return (
    <div
      ref={wrapRef}
      className={`tactics-canvas ${fillParent ? "flex h-full min-h-0 w-full items-center justify-center" : "w-full min-w-0"}`}
    >
      <div
        className="relative overflow-hidden rounded-xl border border-slate-700 shadow-2xl"
        style={{ width: stageW, height: stageH }}
      >
        <Stage
          ref={stageRef}
          width={stageW}
          height={stageH}
          scaleX={scale}
          scaleY={scale}
          listening={!preview}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ cursor: preview ? "default" : toolMode !== "select" && !isPlaying ? "crosshair" : "default" }}
        >
          <Layer listening={!preview}>
            <Group
              x={rotated.w / 2}
              y={rotated.h / 2}
              offsetX={viewport.w / 2}
              offsetY={viewport.h / 2}
              rotation={rotation}
              clipX={0}
              clipY={0}
              clipWidth={viewport.w}
              clipHeight={viewport.h}
            >
              <Group ref={fieldGroupRef} x={-viewport.x} y={-viewport.y}>
                <Rect
                  x={0}
                  y={0}
                  width={FIELD_WIDTH}
                  height={FIELD_HEIGHT}
                  fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                  fillLinearGradientEndPoint={{ x: FIELD_WIDTH, y: FIELD_HEIGHT }}
                  fillLinearGradientColorStops={[0, "#2d8a4e", 0.5, "#358f55", 1, "#2d8a4e"]}
                />
                {/* Abwechselnde hell-/dunkelgrüne Rasenstreifen für Tiefe */}
                {showsFieldStripes(fieldView) &&
                  Array.from({ length: 10 }).map((_, i) => {
                    const stripeW = FIELD_WIDTH / 10;
                    return (
                      <Rect
                        key={`stripe-${i}`}
                        x={stripeW * i}
                        y={0}
                        width={stripeW}
                        height={FIELD_HEIGHT}
                        fill={i % 2 === 0 ? "#2f914f" : "#277a43"}
                        listening={false}
                      />
                    );
                  })}
                {showsFieldLines(fieldView) && <FootballFieldLines />}

                {elements.map((el) => (
                  <BoardElementShape
                    key={el.id}
                    element={el}
                    selected={!preview && el.id === selectedId}
                    draggable={!preview && !isPlaying && toolMode === "select"}
                    labelCounterRotation={rotation}
                    onSelect={() => onSelect(el.id)}
                    onDragEnd={(x, y) => onElementMove(el.id, x, y)}
                    onLineDragEnd={(dx, dy) => onLineMove(el.id, dx, dy)}
                    onTransformEnd={(x, y, rotationDeg) =>
                      onElementTransform?.(el.id, x, y, rotationDeg)
                    }
                  />
                ))}

                {lineDraft && (
                  <Circle x={lineDraft.x} y={lineDraft.y} radius={6} fill="#38bdf8" opacity={0.8} />
                )}
              </Group>
            </Group>
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
