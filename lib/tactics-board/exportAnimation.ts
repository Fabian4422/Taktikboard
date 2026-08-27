import { GIFEncoder, quantize, applyPalette } from "gifenc";
import tsWhammy from "ts-whammy";
import {
  cloneElements,
  getPlaybackPlan,
  interpolateElementsTimed,
  EXPORT_GIF_HEIGHT,
  EXPORT_GIF_WIDTH,
  EXPORT_VIDEO_HEIGHT,
  EXPORT_VIDEO_WIDTH,
  type BoardElement,
  type Keyframe,
} from "./types";

export const VIDEO_EXPORT_FPS = 30;
export const GIF_EXPORT_FPS = 30;
export const EXPORT_FPS = VIDEO_EXPORT_FPS;
const HOLD_LAST_FRAME_MS = 400;
const WEBP_QUALITY = 0.92;

export { EXPORT_VIDEO_WIDTH, EXPORT_VIDEO_HEIGHT, EXPORT_GIF_WIDTH, EXPORT_GIF_HEIGHT };

export type ExportFormat = "video" | "gif";

export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  usedGifFallback?: boolean;
}

export interface StageCapture {
  toCanvas: (config?: { pixelRatio?: number }) => HTMLCanvasElement;
  width: () => number;
  height: () => number;
  draw?: () => void;
  batchDraw?: () => void;
  getLayers?: () => Array<{ draw: () => void }>;
}

export function getElementsAtTime(keyframes: Keyframe[], elapsedMs: number): BoardElement[] {
  const { timings, totalMs } = getPlaybackPlan(keyframes);
  if (timings.length === 0 || totalMs <= 0) {
    return cloneElements(keyframes[keyframes.length - 1]?.elements ?? keyframes[0]?.elements ?? []);
  }
  if (elapsedMs >= totalMs) {
    return cloneElements(keyframes[keyframes.length - 1].elements);
  }

  let remaining = elapsedMs;
  let fromIndex = 0;
  while (fromIndex < timings.length && remaining >= timings[fromIndex].durationMs) {
    remaining -= timings[fromIndex].durationMs;
    fromIndex += 1;
  }

  if (fromIndex >= timings.length) {
    return cloneElements(keyframes[keyframes.length - 1].elements);
  }

  const interpolated = interpolateElementsTimed(
    keyframes[fromIndex].elements,
    keyframes[fromIndex + 1].elements,
    remaining,
    timings[fromIndex],
  );

  return interpolated
    .filter((el) => el.opacity > 0.05)
    .map(({ opacity: _opacity, ...el }) => el);
}

/** Mathematische Zeit des Frames — unabhängig von CPU/Renderdauer. */
export function getFrameTimeMs(frameIndex: number, fps: number, totalMs: number): number {
  return Math.min((frameIndex / fps) * 1000, totalMs);
}

export function getExportFrameCount(keyframes: Keyframe[], fps = EXPORT_FPS): number {
  const { totalMs } = getPlaybackPlan(keyframes);
  const durationMs = totalMs + HOLD_LAST_FRAME_MS;
  return Math.max(1, Math.round((durationMs / 1000) * fps));
}

function even(n: number): number {
  return Math.max(2, n - (n % 2));
}

/** Skaliert Cover in exakte 16:9-Zielgröße (gerade Pixel für Encoder). */
export function fitExactCanvas(
  source: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  const width = even(targetWidth);
  const height = even(targetHeight);
  if (source.width === width && source.height === height) {
    return source;
  }
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#166534";
  ctx.fillRect(0, 0, width, height);
  const scale = Math.max(width / Math.max(source.width, 1), height / Math.max(source.height, 1));
  const dw = source.width * scale;
  const dh = source.height * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(source, dx, dy, dw, dh);
  return out;
}

/** @deprecated Prefer fitExactCanvas — behält Kompatibilität für max-width Downscale. */
export function fitEvenCanvas(source: HTMLCanvasElement, maxWidth: number): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / Math.max(source.width, 1));
  const width = even(Math.round(source.width * scale));
  const height = even(Math.round(source.height * scale));
  return fitExactCanvas(source, width, height);
}

export function captureStageFrame(
  stage: StageCapture,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  stage.batchDraw?.();
  const layers = stage.getLayers?.() ?? [];
  for (const layer of layers) {
    layer.draw();
  }
  stage.draw?.();
  const stageWidth = stage.width();
  const pixelRatio = Math.max(1, Math.min(2, targetWidth / Math.max(stageWidth, 1)));
  const canvas = stage.toCanvas({ pixelRatio });
  return fitExactCanvas(canvas, targetWidth, targetHeight);
}

/**
 * Verstecktes Offscreen-Canvas für den Export (nicht im Viewport sichtbar).
 * Dient als Ziel für Frame-Captures und Bild-Encoding.
 */
export function createOffscreenExportCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  destroy: () => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = even(width);
  canvas.height = even(height);
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;left:-99999px;top:0;width:0;height:0;opacity:0;pointer-events:none;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) {
    canvas.remove();
    throw new Error("Offscreen-Canvas konnte nicht erzeugt werden.");
  }
  return {
    canvas,
    ctx,
    destroy: () => {
      canvas.remove();
    },
  };
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "taktikboard";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function supportsWebpDataUrl(): boolean {
  try {
    const probe = document.createElement("canvas");
    probe.width = 2;
    probe.height = 2;
    const ctx = probe.getContext("2d", { alpha: false });
    if (!ctx) return false;
    ctx.fillStyle = "#228B22";
    ctx.fillRect(0, 0, 2, 2);
    return probe.toDataURL("image/webp", 0.8).startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/** Frame als opakes WebP-Data-URL (ohne Alpha) — Eingabe für Whammy. */
function canvasToWebpDataUrl(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  quality = WEBP_QUALITY,
): string {
  if (target.width !== source.width || target.height !== source.height) {
    target.width = source.width;
    target.height = source.height;
  }
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
  const dataUrl = target.toDataURL("image/webp", quality);
  if (!dataUrl.startsWith("data:image/webp")) {
    throw new Error("WebP-Encoding wird von diesem Browser nicht unterstützt.");
  }
  return dataUrl;
}

function writeGifFrame(
  gif: ReturnType<typeof GIFEncoder>,
  canvas: HTMLCanvasElement,
  fps: number,
  isFirst: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Frame konnte nicht gelesen werden.");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const palette = quantize(imageData.data, 256);
  const index = applyPalette(imageData.data, palette);
  gif.writeFrame(index, canvas.width, canvas.height, {
    palette,
    delay: Math.round(1000 / fps),
    repeat: isFirst ? 0 : undefined,
  });
}

async function paintExportFrame(
  keyframes: Keyframe[],
  stage: StageCapture,
  frameIndex: number,
  fps: number,
  totalMs: number,
  targetWidth: number,
  targetHeight: number,
  renderFrame: (elements: BoardElement[]) => Promise<void>,
): Promise<HTMLCanvasElement> {
  // t = frameIndex / fps — exakte, CPU-unabhängige Zeit
  const elapsedMs = getFrameTimeMs(frameIndex, fps, totalMs);
  await renderFrame(getElementsAtTime(keyframes, elapsedMs));
  return captureStageFrame(stage, targetWidth, targetHeight);
}

async function exportGif({
  keyframes,
  stage,
  fileBaseName,
  fps,
  onProgress,
  renderFrame,
  progressLabel = "GIF wird erstellt…",
}: {
  keyframes: Keyframe[];
  stage: StageCapture;
  fileBaseName: string;
  fps: number;
  onProgress?: (percent: number, label: string) => void;
  renderFrame: (elements: BoardElement[]) => Promise<void>;
  progressLabel?: string;
}): Promise<ExportResult> {
  const { totalMs } = getPlaybackPlan(keyframes);
  const frameCount = getExportFrameCount(keyframes, fps);
  const gif = GIFEncoder();

  for (let i = 0; i < frameCount; i++) {
    const canvas = await paintExportFrame(
      keyframes,
      stage,
      i,
      fps,
      totalMs,
      EXPORT_GIF_WIDTH,
      EXPORT_GIF_HEIGHT,
      renderFrame,
    );
    writeGifFrame(gif, canvas, fps, i === 0);
    onProgress?.(Math.round(((i + 1) / frameCount) * 100), progressLabel);
    if (i % 4 === 0) await wait(0);
  }

  gif.finish();
  const bytes = gif.bytes();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "image/gif" });
  const filename = `${slugify(fileBaseName)}.gif`;
  downloadBlob(blob, filename);
  return { blob, filename, mimeType: "image/gif" };
}

/**
 * Frame-by-Frame Video-Export über Whammy:
 * Jeder Frame wird als WebP-Blob (Data-URL) erzeugt und dem Encoder übergeben.
 * Kein MediaRecorder / kein Live-captureStream — dadurch konstante 30 FPS.
 */
async function exportWithWhammy({
  keyframes,
  stage,
  fileBaseName,
  fps,
  onProgress,
  renderFrame,
}: {
  keyframes: Keyframe[];
  stage: StageCapture;
  fileBaseName: string;
  fps: number;
  onProgress?: (percent: number, label: string) => void;
  renderFrame: (elements: BoardElement[]) => Promise<void>;
}): Promise<ExportResult> {
  if (!supportsWebpDataUrl()) {
    throw new Error("WebP-Export wird nicht unterstützt.");
  }

  const { totalMs } = getPlaybackPlan(keyframes);
  const frameCount = getExportFrameCount(keyframes, fps);
  const label = "Video wird erstellt…";

  const first = await paintExportFrame(
    keyframes,
    stage,
    0,
    fps,
    totalMs,
    EXPORT_VIDEO_WIDTH,
    EXPORT_VIDEO_HEIGHT,
    renderFrame,
  );
  const offscreen = createOffscreenExportCanvas(first.width, first.height);
  const webpFrames: string[] = [];

  try {
    webpFrames.push(canvasToWebpDataUrl(first, offscreen.canvas, offscreen.ctx));
    onProgress?.(Math.round((1 / frameCount) * 100), label);

    for (let i = 1; i < frameCount; i++) {
      const frame = await paintExportFrame(
        keyframes,
        stage,
        i,
        fps,
        totalMs,
        EXPORT_VIDEO_WIDTH,
        EXPORT_VIDEO_HEIGHT,
        renderFrame,
      );
      webpFrames.push(canvasToWebpDataUrl(frame, offscreen.canvas, offscreen.ctx));
      onProgress?.(Math.round(((i + 1) / frameCount) * 100), label);
      // UI atmen lassen (Tablet), ohne die Frame-Zeit zu beeinflussen
      if (i % 2 === 0) await wait(0);
    }

    onProgress?.(100, "Video wird fertiggestellt…");
    const encoded = tsWhammy.fromImageArray(webpFrames, fps);
    const blob =
      encoded instanceof Blob
        ? encoded.type
          ? encoded
          : new Blob([encoded], { type: "video/webm" })
        : new Blob([encoded as BlobPart], { type: "video/webm" });

    if (blob.size < 64) {
      throw new Error("Das erzeugte Video ist leer.");
    }

    const filename = `${slugify(fileBaseName)}.webm`;
    downloadBlob(blob, filename);
    return { blob, filename, mimeType: "video/webm" };
  } finally {
    offscreen.destroy();
  }
}

export interface ExportAnimationOptions {
  keyframes: Keyframe[];
  stage: StageCapture;
  format: ExportFormat;
  fileBaseName: string;
  fps?: number;
  onProgress?: (percent: number, label: string) => void;
  renderFrame: (elements: BoardElement[]) => Promise<void>;
}

export async function exportTacticsAnimation({
  keyframes,
  stage,
  format,
  fileBaseName,
  fps: fpsOverride,
  onProgress,
  renderFrame,
}: ExportAnimationOptions): Promise<ExportResult> {
  const { totalMs } = getPlaybackPlan(keyframes);
  if (totalMs <= 0) {
    throw new Error("Mindestens zwei Schritte mit Inhalt werden für den Export benötigt.");
  }

  const fps = fpsOverride ?? (format === "gif" ? GIF_EXPORT_FPS : VIDEO_EXPORT_FPS);

  if (format === "gif") {
    return exportGif({
      keyframes,
      stage,
      fileBaseName,
      fps,
      onProgress,
      renderFrame,
    });
  }

  try {
    return await exportWithWhammy({
      keyframes,
      stage,
      fileBaseName,
      fps,
      onProgress,
      renderFrame,
    });
  } catch {
    onProgress?.(0, "Video nicht unterstützt – GIF wird erstellt…");
    const gif = await exportGif({
      keyframes,
      stage,
      fileBaseName,
      fps: GIF_EXPORT_FPS,
      onProgress,
      renderFrame,
      progressLabel: "Video nicht unterstützt – GIF wird erstellt…",
    });
    return { ...gif, usedGifFallback: true };
  }
}
