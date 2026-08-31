import {
  cloneElements,
  getPlaybackPlan,
  interpolateElementsTimed,
  EXPORT_GIF_HEIGHT,
  EXPORT_GIF_WIDTH,
  EXPORT_VIDEO_HEIGHT,
  EXPORT_VIDEO_WIDTH,
  type BoardElement,
  type FieldRotation,
  type FieldView,
  type Keyframe,
} from "./types";

export const VIDEO_EXPORT_FPS = 30;
export const GIF_EXPORT_FPS = 30;
export const EXPORT_FPS = VIDEO_EXPORT_FPS;
export const HOLD_LAST_FRAME_MS = 400;
export const WEBP_QUALITY = 0.92;

export { EXPORT_VIDEO_WIDTH, EXPORT_VIDEO_HEIGHT, EXPORT_GIF_WIDTH, EXPORT_GIF_HEIGHT };

export type ExportFormat = "video" | "gif";

export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  usedGifFallback?: boolean;
}

export function even(n: number): number {
  return Math.max(2, n - (n % 2));
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

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "taktikboard";
}

/**
 * MessageChannel ist in Hintergrund-Tabs nicht auf 1s gedrosselt (im Gegensatz zu
 * setTimeout/rAF). So bleibt der Export-Loop auch bei minimiertem Tab flüssig.
 */
export function yieldUnthrottled(): Promise<void> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      port2.close();
      resolve();
    };
    port2.postMessage(null);
  });
}

export interface ExportJob {
  keyframes: Keyframe[];
  fieldView: FieldView;
  fieldRotation: FieldRotation;
  format: ExportFormat;
  fileBaseName: string;
  fps: number;
}

export type ExportWorkerRequest = { type: "start" } & ExportJob;

export type ExportWorkerProgress = {
  type: "progress";
  percent: number;
  label: string;
};

export type ExportWorkerDone = {
  type: "done";
  buffer: ArrayBuffer;
  filename: string;
  mimeType: string;
  usedGifFallback?: boolean;
};

export type ExportWorkerError = {
  type: "error";
  message: string;
};

export type ExportWorkerMessage = ExportWorkerProgress | ExportWorkerDone | ExportWorkerError;
