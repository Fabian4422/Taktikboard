import type { BoardElement, FieldRotation, FieldView } from "./types";
import {
  DISPLAY_ASPECT_RATIO,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  LETTERBOX_COLOR,
  getElementScale,
} from "./types";
import {
  getEffectiveRotation,
  getFieldLayout,
  getFieldMarkingArcs,
  getFieldViewport,
  getRotatedViewportSize,
  showsFieldLines,
  showsFieldStripes,
} from "./fieldLayout";
import {
  ELEMENT_META,
  arrowHeadPoints,
  buildWavePoints,
  getPlayerRadius,
} from "./elementStyles";
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
} from "./equipmentGeometry";

export type ExportDrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function strokePolyline(
  ctx: ExportDrawContext,
  points: number[],
  closed = false,
) {
  if (points.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  if (closed) ctx.closePath();
}

function fillPolyline(ctx: ExportDrawContext, points: number[]) {
  strokePolyline(ctx, points, true);
  ctx.fill();
}

function getConePalette(color: string) {
  switch (color.toLowerCase()) {
    case "#eab308":
      return { fill: "#eab308", stroke: "#a16207", stripe: "#fde047", tip: "#fefce8" };
    case "#3b82f6":
      return { fill: "#3b82f6", stroke: "#1d4ed8", stripe: "#93c5fd", tip: "#eff6ff" };
    case "#ef4444":
      return { fill: "#ef4444", stroke: "#b91c1c", stripe: "#fca5a5", tip: "#fef2f2" };
    case "#f8fafc":
      return { fill: "#f8fafc", stroke: "#64748b", stripe: "#e2e8f0", tip: "#ffffff" };
    case "#f97316":
    default:
      return { fill: "#f97316", stroke: "#c2410c", stripe: "#fdba74", tip: "#fff7ed" };
  }
}

function drawFieldLines(ctx: ExportDrawContext) {
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

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  strokePolyline(ctx, [left, top, right, top, right, bottom, left, bottom, left, top]);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, spotR, 0, Math.PI * 2);
  ctx.fill();

  strokePolyline(ctx, [
    left,
    cy - penaltyH / 2,
    left + penaltyW,
    cy - penaltyH / 2,
    left + penaltyW,
    cy + penaltyH / 2,
    left,
    cy + penaltyH / 2,
  ]);
  ctx.stroke();
  strokePolyline(ctx, [
    right,
    cy - penaltyH / 2,
    right - penaltyW,
    cy - penaltyH / 2,
    right - penaltyW,
    cy + penaltyH / 2,
    right,
    cy + penaltyH / 2,
  ]);
  ctx.stroke();
  strokePolyline(ctx, [
    left,
    cy - goalAreaH / 2,
    left + goalAreaW,
    cy - goalAreaH / 2,
    left + goalAreaW,
    cy + goalAreaH / 2,
    left,
    cy + goalAreaH / 2,
  ]);
  ctx.stroke();
  strokePolyline(ctx, [
    right,
    cy - goalAreaH / 2,
    right - goalAreaW,
    cy - goalAreaH / 2,
    right - goalAreaW,
    cy + goalAreaH / 2,
    right,
    cy + goalAreaH / 2,
  ]);
  ctx.stroke();

  ctx.lineCap = "round";
  for (const pts of penaltyArcs) {
    strokePolyline(ctx, pts);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const spot of penaltySpots) {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spotR, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pts of cornerArcs) {
    strokePolyline(ctx, pts);
    ctx.stroke();
  }

  ctx.lineCap = "butt";
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  fillPolyline(ctx, [
    left - goalW,
    cy - goalH / 2,
    left,
    cy - goalH / 2,
    left,
    cy + goalH / 2,
    left - goalW,
    cy + goalH / 2,
  ]);
  ctx.stroke();
  fillPolyline(ctx, [
    right,
    cy - goalH / 2,
    right + goalW,
    cy - goalH / 2,
    right + goalW,
    cy + goalH / 2,
    right,
    cy + goalH / 2,
  ]);
  ctx.stroke();
}

function drawGoal(ctx: ExportDrawContext, geo: GoalGeometry) {
  const isBig = geo === BIG_GOAL;
  const jointR = isBig ? 3.2 : 2.2;
  const postFill = "#f8fafc";
  const postStroke = "#94a3b8";

  ctx.fillStyle = "rgba(15,23,42,0.16)";
  ctx.fillRect(-geo.depth, -geo.halfWidth, geo.depth, geo.halfWidth * 2);

  ctx.fillStyle = "rgba(248,250,252,0.18)";
  fillPolyline(ctx, geo.netFill);

  ctx.strokeStyle = "rgba(226,232,240,0.7)";
  ctx.lineWidth = 0.7;
  for (const pts of geo.netLines) {
    strokePolyline(ctx, pts);
    ctx.stroke();
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const line of geo.frameLines) {
    ctx.strokeStyle = postStroke;
    ctx.lineWidth = line.width + 1.8;
    strokePolyline(ctx, line.points);
    ctx.stroke();
  }
  for (const line of geo.frameLines) {
    ctx.strokeStyle = postFill;
    ctx.lineWidth = line.width;
    strokePolyline(ctx, line.points);
    ctx.stroke();
  }

  ctx.fillStyle = postFill;
  ctx.strokeStyle = postStroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(geo.frontLeft.x, geo.frontLeft.y, jointR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(geo.frontRight.x, geo.frontRight.y, jointR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.arc(geo.backLeft.x, geo.backLeft.y, jointR * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(geo.backRight.x, geo.backRight.y, jointR * 0.75, 0, Math.PI * 2);
  ctx.fill();
}

function drawHurdle(ctx: ExportDrawContext) {
  const { halfW, postH, barY, footW, footH, postW, stripeH, stripeCount } = HURDLE;
  const postX = halfW - 4;

  const drawPost = (x: number) => {
    ctx.save();
    ctx.translate(x, 0);
    ctx.fillStyle = "#111827";
    ctx.fillRect(-postW / 2, -postH, postW, postH);
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 !== 0) continue;
      ctx.fillStyle = "#facc15";
      ctx.fillRect(-postW / 2, -postH + i * stripeH, postW, stripeH);
    }
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(-footW / 2, -footH / 2, footW, footH);
    ctx.restore();
  };

  drawPost(-postX);
  drawPost(postX);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth = 4.2;
  strokePolyline(ctx, [-postX, barY + 6, -postX + 4, barY, postX - 4, barY, postX, barY + 6]);
  ctx.stroke();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2;
  strokePolyline(ctx, [
    -postX + 1,
    barY + 7,
    -postX + 5,
    barY + 1.5,
    postX - 5,
    barY + 1.5,
    postX - 1,
    barY + 7,
  ]);
  ctx.stroke();
}

function drawCone(ctx: ExportDrawContext, color?: string) {
  const palette = getConePalette(color ?? "#f97316");
  ctx.fillStyle = "rgba(15,23,42,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.fill;
  fillPolyline(ctx, [0, -14, 11, 8, -11, 8]);

  ctx.strokeStyle = palette.stripe;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-5, 1);
  ctx.lineTo(5, 1);
  ctx.stroke();
  ctx.strokeStyle = palette.tip;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3.5, -6);
  ctx.lineTo(3.5, -6);
  ctx.stroke();

  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 1.4;
  strokePolyline(ctx, [0, -14, 11, 8, -11, 8], true);
  ctx.stroke();
}

function drawBall(ctx: ExportDrawContext) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  const gradient = ctx.createRadialGradient(-4, -5, 1, 0, 0, BALL_RADIUS);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.55, "#f1f5f9");
  gradient.addColorStop(1, "#cbd5e1");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  fillPolyline(ctx, BALL_CENTER_PENTAGON);
  for (const pts of BALL_OUTER_PENTAGONS) {
    fillPolyline(ctx, pts);
  }

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 0.9;
  for (const pts of BALL_HEXAGONS) {
    strokePolyline(ctx, pts, true);
    ctx.stroke();
  }
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.7;
  for (const pts of BALL_SEAMS) {
    strokePolyline(ctx, pts);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLineElement(ctx: ExportDrawContext, element: BoardElement) {
  const points = element.points;
  if (!points || points.length < 4) return;
  const [x1, y1, x2, y2] = points;
  const meta = ELEMENT_META[element.type];
  const isPass = element.type === "pass-line";
  const isRun = element.type === "run-path";
  const isDribble = element.type === "dribble-path";
  const isGuide = element.type === "guide-line";
  const showArrow = isPass || isRun || isDribble;
  const linePoints = isDribble ? buildWavePoints(x1, y1, x2, y2) : [x1, y1, x2, y2];
  const arrowPoints = showArrow ? arrowHeadPoints(x1, y1, x2, y2, isPass || isDribble ? 14 : 12) : [];

  ctx.strokeStyle = meta.color;
  ctx.lineWidth = isPass ? 3.5 : 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(isGuide ? [10, 8] : []);
  strokePolyline(ctx, linePoints);
  ctx.stroke();
  ctx.setLineDash([]);

  if (showArrow && arrowPoints.length >= 4) {
    strokePolyline(ctx, arrowPoints);
    ctx.stroke();
  }
}

function drawMarkerElement(
  ctx: ExportDrawContext,
  element: BoardElement,
  fieldRotation: FieldRotation,
) {
  const meta = ELEMENT_META[element.type];
  const scale = getElementScale(element);
  const rotation = element.rotation ?? 0;

  ctx.save();
  ctx.translate(element.x, element.y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);

  switch (element.type) {
    case "player-a":
    case "player-b":
    case "player-c":
    case "player-d":
    case "player-gk": {
      const r = getPlayerRadius(element.type);
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = meta.color;
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      if (element.number != null) {
        ctx.save();
        ctx.rotate((-(fieldRotation + rotation) * Math.PI) / 180);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(element.number), 0, 0);
        ctx.restore();
      }
      break;
    }
    case "cone":
      drawCone(ctx, element.color);
      break;
    case "hurdle":
      drawHurdle(ctx);
      break;
    case "mini-goal":
      drawGoal(ctx, MINI_GOAL);
      break;
    case "big-goal":
      drawGoal(ctx, BIG_GOAL);
      break;
    case "ball":
      drawBall(ctx);
      break;
    default:
      break;
  }

  ctx.restore();
}

export function drawExportFrame(
  ctx: ExportDrawContext,
  width: number,
  height: number,
  elements: BoardElement[],
  fieldView: FieldView,
  fieldRotation: FieldRotation,
) {
  const viewport = getFieldViewport(fieldView);
  const rotation = getEffectiveRotation(fieldView, fieldRotation);
  const rotated = getRotatedViewportSize(viewport, rotation);

  let stageW = width;
  let stageH = height;
  if (stageW / stageH > DISPLAY_ASPECT_RATIO) {
    stageH = height;
    stageW = height * DISPLAY_ASPECT_RATIO;
  } else {
    stageW = width;
    stageH = width / DISPLAY_ASPECT_RATIO;
  }

  const scale = Math.min(stageW / Math.max(rotated.w, 1), stageH / Math.max(rotated.h, 1));
  const logicalW = stageW / scale;
  const logicalH = stageH / scale;
  const contentOffsetX = (logicalW - rotated.w) / 2;
  const contentOffsetY = (logicalH - rotated.h) / 2;
  const stageOffsetX = (width - stageW) / 2;
  const stageOffsetY = (height - stageH) / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = LETTERBOX_COLOR;
  ctx.fillRect(0, 0, width, height);

  ctx.setTransform(scale, 0, 0, scale, stageOffsetX, stageOffsetY);
  ctx.fillStyle = LETTERBOX_COLOR;
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.save();
  ctx.translate(contentOffsetX, contentOffsetY);
  ctx.translate(rotated.w / 2, rotated.h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-viewport.w / 2, -viewport.h / 2);
  ctx.beginPath();
  ctx.rect(0, 0, viewport.w, viewport.h);
  ctx.clip();
  ctx.translate(-viewport.x, -viewport.y);

  if (showsFieldStripes(fieldView)) {
    const stripeW = FIELD_WIDTH / 10;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#2f914f" : "#277a43";
      ctx.fillRect(stripeW * i, 0, stripeW, FIELD_HEIGHT);
    }
  } else {
    ctx.fillStyle = "#2d8a4e";
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  }

  if (showsFieldLines(fieldView)) {
    drawFieldLines(ctx);
  }

  for (const el of elements) {
    if (el.points && el.points.length >= 4) {
      drawLineElement(ctx, el);
    } else {
      drawMarkerElement(ctx, el, rotation);
    }
  }

  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
