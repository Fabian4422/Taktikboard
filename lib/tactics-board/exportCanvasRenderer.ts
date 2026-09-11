import type { BoardElement, FieldRotation, FieldView } from "./types";
import {
  DEFAULT_TEXT_BOX_PADDING,
  DEFAULT_TEXT_BOX_TEXT,
  DISPLAY_ASPECT_RATIO,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  LETTERBOX_COLOR,
  getElementScale,
  getTextBoxBackgroundOpacity,
  getTextBoxBgColor,
  getTextBoxBgStyle,
  getTextBoxBorderRadius,
  getTextBoxColor,
  getTextBoxFontFamily,
  getTextBoxFontSize,
  getTextBoxWidth,
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
  CONE_TRIANGLE,
  DUMMY,
  HURDLE,
  MINI_GOAL,
  POLE,
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
  const postFill = "#f8fafc";
  const postStroke = "#e2e8f0";

  ctx.fillStyle = "rgba(248,250,252,0.14)";
  fillPolyline(ctx, geo.netFill);

  ctx.strokeStyle = "rgba(226,232,240,0.75)";
  ctx.lineWidth = 0.65;
  for (const pts of geo.netLines) {
    strokePolyline(ctx, pts);
    ctx.stroke();
  }

  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  for (const line of geo.frameLines) {
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = line.width + 1.4;
    strokePolyline(ctx, line.points);
    ctx.stroke();
  }
  for (let i = 0; i < geo.frameLines.length; i++) {
    const line = geo.frameLines[i];
    ctx.strokeStyle = i === 0 ? postFill : postStroke;
    ctx.lineWidth = line.width;
    strokePolyline(ctx, line.points);
    ctx.stroke();
  }
  ctx.strokeStyle = postFill;
  ctx.lineWidth = geo.postWidth + 0.6;
  strokePolyline(ctx, [geo.frontLeft.x, geo.frontLeft.y, geo.frontRight.x, geo.frontRight.y]);
  ctx.stroke();
}

function drawHurdle(ctx: ExportDrawContext) {
  const { halfSpan, barWidth, footLen, footWidth } = HURDLE;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = barWidth + 0.8;
  strokePolyline(ctx, [-halfSpan, 0, halfSpan, 0]);
  ctx.stroke();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = barWidth;
  strokePolyline(ctx, [-halfSpan, 0, halfSpan, 0]);
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(-halfSpan - footWidth / 2, -footLen / 2, footWidth, footLen);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(halfSpan - footWidth / 2, -footLen / 2, footWidth, footLen);
  ctx.fill();
  ctx.stroke();
}

function drawCone(ctx: ExportDrawContext, color?: string) {
  const palette = getConePalette(color ?? "#f97316");
  ctx.fillStyle = palette.fill;
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 1.4;
  fillPolyline(ctx, CONE_TRIANGLE);
  strokePolyline(ctx, CONE_TRIANGLE, true);
  ctx.stroke();
}

function drawPole(ctx: ExportDrawContext) {
  const { radius, plusHalf, stroke } = POLE;
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-plusHalf, 0);
  ctx.lineTo(plusHalf, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -plusHalf);
  ctx.lineTo(0, plusHalf);
  ctx.stroke();
}

function drawDummy(ctx: ExportDrawContext, color?: string) {
  const palette = getConePalette(color ?? "#eab308");
  ctx.fillStyle = palette.fill;
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 1.4;

  ctx.beginPath();
  ctx.ellipse(0, 0, DUMMY.bodyRx, DUMMY.bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, DUMMY.shoulderY, DUMMY.shoulderRx, DUMMY.shoulderRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, -DUMMY.bodyRy + 1, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBall(ctx: ExportDrawContext) {
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  fillPolyline(ctx, BALL_CENTER_PENTAGON);
  for (const pts of BALL_OUTER_PENTAGONS) {
    fillPolyline(ctx, pts);
  }

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 0.85;
  for (const pts of BALL_HEXAGONS) {
    strokePolyline(ctx, pts, true);
    ctx.stroke();
  }
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.65;
  for (const pts of BALL_SEAMS) {
    strokePolyline(ctx, pts);
    ctx.stroke();
  }

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.3;
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
    case "pole":
      drawPole(ctx);
      break;
    case "hurdle":
      drawHurdle(ctx);
      break;
    case "dummy":
      drawDummy(ctx, element.color);
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
    case "text-box": {
      const text = element.text || DEFAULT_TEXT_BOX_TEXT;
      const fontSize = getTextBoxFontSize(element);
      const fontFamily = getTextBoxFontFamily(element);
      const textColor = getTextBoxColor(element);
      const bgColor = getTextBoxBgColor(element);
      const bgStyle = getTextBoxBgStyle(element);
      const bgOpacity = getTextBoxBackgroundOpacity(bgStyle);
      const borderRadius = getTextBoxBorderRadius(element);
      const boxWidth = getTextBoxWidth(element);
      const padding = DEFAULT_TEXT_BOX_PADDING;
      const lineCount = Math.max(1, text.split("\n").length);
      const approxLines = Math.max(
        lineCount,
        Math.ceil(text.length / Math.max(8, Math.floor((boxWidth - padding * 2) / (fontSize * 0.55)))),
      );
      const boxHeight = Math.max(fontSize + padding * 2, approxLines * fontSize * 1.3 + padding * 2);

      if (bgOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = bgOpacity;
        ctx.fillStyle = bgColor;
        roundRect(ctx, -padding, -padding, boxWidth + padding, boxHeight, borderRadius);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(148,163,184,0.35)";
        ctx.lineWidth = 1;
        roundRect(ctx, -padding, -padding, boxWidth + padding, boxHeight, borderRadius);
        ctx.stroke();
      }

      ctx.fillStyle = textColor;
      ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      wrapFillText(ctx, text, 0, 0, boxWidth, fontSize * 1.3);
      break;
    }
    default:
      break;
  }

  ctx.restore();
}

function roundRect(
  ctx: ExportDrawContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapFillText(
  ctx: ExportDrawContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const paragraphs = text.split("\n");
  let cursorY = y;
  for (const paragraph of paragraphs) {
    const words = paragraph.length > 0 ? paragraph.split(/\s+/) : [""];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        cursorY += lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
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

  // 1) Nur Rasen/Linien mit Feldrotation
  ctx.save();
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
  ctx.restore();

  // 2) Objekte im starren Viewport-Raum (X rechts, Y unten)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, rotated.w, rotated.h);
  ctx.clip();

  for (const el of elements) {
    if (el.points && el.points.length >= 4) {
      drawLineElement(ctx, el);
    } else {
      drawMarkerElement(ctx, el, 0);
    }
  }
  ctx.restore();

  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
