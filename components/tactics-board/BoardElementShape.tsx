"use client";

import { useEffect, useRef } from "react";
import { Circle, Group, Line, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { BoardElement } from "@/lib/tactics-board/types";
import { getElementScale, isRotatable } from "@/lib/tactics-board/types";
import {
  ELEMENT_META,
  arrowHeadPoints,
  buildWavePoints,
  getPlayerRadius,
} from "@/lib/tactics-board/elementStyles";
import {
  ConeIcon,
  DummyIcon,
  GoalIcon,
  HurdleIcon,
  PoleIcon,
  SoccerBallIcon,
} from "./equipmentShapes";

interface BoardElementShapeProps {
  element: BoardElement;
  selected: boolean;
  draggable: boolean;
  /** Gegenrotation für Labels, damit Text bei Feld-Drehung waagerecht bleibt */
  labelCounterRotation?: number;
  /** Reiner Klick (ohne Drag) — öffnet Eigenschaften-Panel */
  onSelect: () => void;
  /** Pointer-Down auf Objekt — Panel sofort schließen (vor Klick/Drag-Entscheidung) */
  onPointerIntent?: () => void;
  /** Drag hat Schwelle überschritten — Panel bleibt zu */
  onDragStart?: () => void;
  onDragEnd: (x: number, y: number) => void;
  onLineDragEnd: (dx: number, dy: number) => void;
  onTransformEnd?: (x: number, y: number, rotation: number) => void;
}

const DRAG_THRESHOLD_PX = 8;

export function BoardElementShape({
  element,
  selected,
  draggable,
  labelCounterRotation = 0,
  onSelect,
  onPointerIntent,
  onDragStart,
  onDragEnd,
  onLineDragEnd,
  onTransformEnd,
}: BoardElementShapeProps) {
  const meta = ELEMENT_META[element.type];
  const shapeRef = useRef(null);
  const transformerRef = useRef(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const canRotate = isRotatable(element.type);
  const elementScale = getElementScale(element);
  const uprightLabelRotation = -(labelCounterRotation + (element.rotation ?? 0));

  useEffect(() => {
    const transformer = transformerRef.current as {
      nodes: (nodes: unknown[]) => void;
      getLayer: () => { batchDraw: () => void } | null;
    } | null;
    const shape = shapeRef.current;
    if (!transformer) return;
    if (selected && canRotate && draggable && shape) {
      transformer.nodes([shape]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
    }
  }, [selected, canRotate, draggable, element.id]);

  const getClientPoint = (e: {
    evt?: MouseEvent | TouchEvent;
  }): { x: number; y: number } | null => {
    const evt = e.evt;
    if (!evt) return null;
    if ("touches" in evt && evt.touches[0]) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    if ("changedTouches" in evt && evt.changedTouches[0]) {
      return { x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY };
    }
    if ("clientX" in evt) {
      return { x: evt.clientX, y: evt.clientY };
    }
    return null;
  };

  const selectHandlers = {
    name: "board-element" as const,
    onMouseDown: (e: { cancelBubble: boolean; evt?: MouseEvent | TouchEvent }) => {
      e.cancelBubble = true;
      const pt = getClientPoint(e);
      pointerStartRef.current = pt;
      didDragRef.current = false;
      onPointerIntent?.();
    },
    onTouchStart: (e: { cancelBubble: boolean; evt?: MouseEvent | TouchEvent }) => {
      e.cancelBubble = true;
      e.evt && "preventDefault" in e.evt && e.evt.preventDefault?.();
      const pt = getClientPoint(e);
      pointerStartRef.current = pt;
      didDragRef.current = false;
      onPointerIntent?.();
    },
    onMouseMove: (e: { evt?: MouseEvent | TouchEvent }) => {
      if (!pointerStartRef.current || didDragRef.current || !draggable) return;
      const pt = getClientPoint(e);
      if (!pt) return;
      const dist = Math.hypot(pt.x - pointerStartRef.current.x, pt.y - pointerStartRef.current.y);
      if (dist >= DRAG_THRESHOLD_PX) {
        didDragRef.current = true;
        onDragStart?.();
      }
    },
    onTouchMove: (e: { evt?: MouseEvent | TouchEvent }) => {
      if (!pointerStartRef.current || didDragRef.current || !draggable) return;
      const pt = getClientPoint(e);
      if (!pt) return;
      const dist = Math.hypot(pt.x - pointerStartRef.current.x, pt.y - pointerStartRef.current.y);
      if (dist >= DRAG_THRESHOLD_PX) {
        didDragRef.current = true;
        onDragStart?.();
      }
    },
    onDragStart: (e: { cancelBubble: boolean }) => {
      e.cancelBubble = true;
      if (didDragRef.current) return;
      didDragRef.current = true;
      onDragStart?.();
    },
    onClick: (e: { cancelBubble: boolean }) => {
      e.cancelBubble = true;
      // Nur reiner Klick (kein Drag) öffnet das Eigenschaften-Panel
      if (didDragRef.current) return;
      onSelect();
    },
  };

  if (element.points && element.points.length >= 4) {
    const [x1, y1, x2, y2] = element.points;
    const isPass = element.type === "pass-line";
    const isRun = element.type === "run-path";
    const isDribble = element.type === "dribble-path";
    const isGuide = element.type === "guide-line";
    const showArrow = isPass || isRun || isDribble;

    const linePoints = isDribble ? buildWavePoints(x1, y1, x2, y2) : [x1, y1, x2, y2];
    const arrowPoints = showArrow
      ? arrowHeadPoints(x1, y1, x2, y2, isPass || isDribble ? 14 : 12)
      : [];

    return (
      <Group
        {...selectHandlers}
        draggable={draggable}
        onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
          const node = e.target;
          onLineDragEnd(node.x(), node.y());
          node.position({ x: 0, y: 0 });
          pointerStartRef.current = null;
        }}
      >
        <Line
          points={linePoints}
          stroke={meta.color}
          strokeWidth={selected ? 4 : isPass ? 3.5 : 3}
          dash={isGuide ? [10, 8] : undefined}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={16}
        />
        {showArrow && (
          <Line
            points={arrowPoints}
            stroke={meta.color}
            strokeWidth={selected ? 4 : isPass ? 3.5 : 3}
            lineCap="round"
          />
        )}
        {selected && (
          <Circle x={x1} y={y1} radius={6} fill="white" stroke="#0ea5e9" strokeWidth={2} />
        )}
        {selected && (
          <Circle x={x2} y={y2} radius={6} fill="white" stroke="#0ea5e9" strokeWidth={2} />
        )}
      </Group>
    );
  }

  const commonGroupProps = {
    ...selectHandlers,
    ref: shapeRef,
    x: element.x,
    y: element.y,
    rotation: element.rotation ?? 0,
    scaleX: elementScale,
    scaleY: elementScale,
    draggable,
    onDragEnd: (e: { target: { x: () => number; y: () => number } }) => {
      onDragEnd(e.target.x(), e.target.y());
      pointerStartRef.current = null;
    },
    onTransformEnd: (e: { target: { x: () => number; y: () => number; rotation: () => number } }) => {
      const node = e.target;
      onTransformEnd?.(node.x(), node.y(), node.rotation());
    },
  };

  const transformer = selected && canRotate && draggable ? (
    <Transformer
      ref={transformerRef}
      rotateEnabled
      enabledAnchors={[]}
      rotateAnchorOffset={20}
      borderEnabled={false}
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
      rotateAnchorFill="#38bdf8"
      rotateAnchorStroke="#0ea5e9"
      anchorSize={10}
    />
  ) : null;

  switch (element.type) {
    case "player-a":
    case "player-b":
    case "player-c":
    case "player-d":
    case "player-gk": {
      const r = getPlayerRadius(element.type);
      return (
        <Group {...commonGroupProps}>
          <Circle
            radius={r}
            fill={meta.color}
            stroke={selected ? "#ffffff" : "#1e293b"}
            strokeWidth={selected ? 3 : 2}
            shadowColor="black"
            shadowBlur={4}
            shadowOpacity={0.3}
          />
          {element.number != null && (
            <Text
              text={String(element.number)}
              fontSize={12}
              fontStyle="bold"
              fill="white"
              width={r * 2}
              height={r * 2}
              offsetX={r}
              offsetY={r}
              align="center"
              verticalAlign="middle"
              rotation={uprightLabelRotation}
              listening={false}
            />
          )}
        </Group>
      );
    }

    case "cone":
      return (
        <Group>
          <Group {...commonGroupProps}>
            <ConeIcon selected={selected} color={element.color} />
          </Group>
          {transformer}
        </Group>
      );

    case "pole":
      return (
        <Group {...commonGroupProps}>
          <PoleIcon selected={selected} />
        </Group>
      );

    case "hurdle":
      return (
        <Group>
          <Group {...commonGroupProps}>
            <HurdleIcon selected={selected} />
          </Group>
          {transformer}
        </Group>
      );

    case "dummy":
      return (
        <Group>
          <Group {...commonGroupProps}>
            <DummyIcon selected={selected} color={element.color} />
          </Group>
          {transformer}
        </Group>
      );

    case "mini-goal":
    case "big-goal":
      return (
        <Group>
          <Group {...commonGroupProps}>
            <GoalIcon kind={element.type} selected={selected} />
          </Group>
          {transformer}
        </Group>
      );

    case "ball":
      return (
        <Group {...commonGroupProps}>
          <SoccerBallIcon selected={selected} />
        </Group>
      );

    default:
      return null;
  }
}
