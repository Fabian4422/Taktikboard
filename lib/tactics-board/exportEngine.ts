import { GIFEncoder, quantize, applyPalette } from "gifenc";
import tsWhammy from "ts-whammy";
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeVideo,
} from "mediabunny";
import { getPlaybackPlan } from "./types";
import { drawExportFrame } from "./exportCanvasRenderer";
import {
  EXPORT_GIF_HEIGHT,
  EXPORT_GIF_WIDTH,
  EXPORT_VIDEO_HEIGHT,
  EXPORT_VIDEO_WIDTH,
  GIF_EXPORT_FPS,
  WEBP_QUALITY,
  even,
  getElementsAtTime,
  getExportFrameCount,
  getFrameTimeMs,
  slugify,
  yieldUnthrottled,
  type ExportJob,
  type ExportResult,
} from "./exportShared";

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type AnyCtx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function createExportCanvas(width: number, height: number): { canvas: AnyCanvas; ctx: AnyCtx } {
  const w = even(width);
  const h = even(height);

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (ctx) return { canvas, ctx };
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (ctx) return { canvas, ctx };
  }

  throw new Error("OffscreenCanvas wird von diesem Browser nicht unterstützt.");
}

async function canvasToWebpDataUrl(canvas: AnyCanvas): Promise<string> {
  const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  if (!blob || blob.size < 8) {
    throw new Error("WebP-Encoding wird von diesem Browser nicht unterstützt.");
  }
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunk = 0x4000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return `data:image/webp;base64,${btoa(binary)}`;
}

function canvasToBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas && typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Frame konnte nicht kodiert werden."));
      },
      type,
      quality,
    );
  });
}

async function pickVideoCodec(
  width: number,
  height: number,
): Promise<{ codec: "vp9" | "vp8" | "av1" | "avc"; container: "webm" | "mp4" } | null> {
  const candidates: Array<{ codec: "vp9" | "vp8" | "av1" | "avc"; container: "webm" | "mp4" }> = [
    { codec: "vp9", container: "webm" },
    { codec: "vp8", container: "webm" },
    { codec: "av1", container: "webm" },
    { codec: "avc", container: "mp4" },
  ];
  for (const candidate of candidates) {
    try {
      const supported = await canEncodeVideo(candidate.codec, {
        width,
        height,
        bitrate: QUALITY_HIGH,
      });
      if (supported) return candidate;
    } catch {
      // Codec/Browser-Kombination nicht verfügbar
    }
  }
  return null;
}

function ensureCanvasSize(canvas: AnyCanvas, width: number, height: number): AnyCtx {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Canvas-Kontext konnte nicht erzeugt werden.");
  }
  return ctx;
}

function writeGifFrame(
  gif: ReturnType<typeof GIFEncoder>,
  ctx: AnyCtx,
  width: number,
  height: number,
  fps: number,
  isFirst: boolean,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const palette = quantize(imageData.data, 256);
  const index = applyPalette(imageData.data, palette);
  gif.writeFrame(index, width, height, {
    palette,
    delay: Math.round(1000 / fps),
    repeat: isFirst ? 0 : undefined,
  });
}

async function exportGifJob(
  job: ExportJob,
  canvas: AnyCanvas,
  width: number,
  height: number,
  onProgress: (percent: number, label: string) => void,
  progressLabel: string,
): Promise<ExportResult> {
  const ctx = ensureCanvasSize(canvas, width, height);
  const { totalMs } = getPlaybackPlan(job.keyframes);
  const frameCount = getExportFrameCount(job.keyframes, job.fps);
  const gif = GIFEncoder();

  for (let i = 0; i < frameCount; i++) {
    const elapsedMs = getFrameTimeMs(i, job.fps, totalMs);
    drawExportFrame(
      ctx,
      width,
      height,
      getElementsAtTime(job.keyframes, elapsedMs),
      job.fieldView,
      job.fieldRotation,
    );
    writeGifFrame(gif, ctx, width, height, job.fps, i === 0);
    onProgress(Math.round(((i + 1) / frameCount) * 100), progressLabel);
    if (i % 2 === 0) await yieldUnthrottled();
  }

  gif.finish();
  const bytes = gif.bytes();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return {
    blob: new Blob([copy], { type: "image/gif" }),
    filename: `${slugify(job.fileBaseName)}.gif`,
    mimeType: "image/gif",
  };
}

async function exportWithWebCodecs(
  job: ExportJob,
  canvas: AnyCanvas,
  ctx: AnyCtx,
  width: number,
  height: number,
  onProgress: (percent: number, label: string) => void,
): Promise<ExportResult> {
  const codec = await pickVideoCodec(width, height);
  if (!codec) {
    throw new Error("Kein Video-Codec verfügbar.");
  }

  const { totalMs } = getPlaybackPlan(job.keyframes);
  const frameCount = getExportFrameCount(job.keyframes, job.fps);
  const frameDuration = 1 / job.fps;
  const label = "Video wird gerendert";

  const target = new BufferTarget();
  const output = new Output({
    format: codec.container === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  });
  const source = new CanvasSource(canvas, {
    codec: codec.codec,
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(source);
  await output.start();

  try {
    for (let i = 0; i < frameCount; i++) {
      const elapsedMs = getFrameTimeMs(i, job.fps, totalMs);
      drawExportFrame(
        ctx,
        width,
        height,
        getElementsAtTime(job.keyframes, elapsedMs),
        job.fieldView,
        job.fieldRotation,
      );
      await source.add(i * frameDuration, frameDuration);
      onProgress(Math.round(((i + 1) / frameCount) * 100), label);
      if (i % 2 === 0) await yieldUnthrottled();
    }
    onProgress(100, "Video wird fertiggestellt…");
    await output.finalize();
  } catch (error) {
    const maybeCancel = (output as { cancel?: () => Promise<void> }).cancel;
    if (maybeCancel) {
      try {
        await maybeCancel.call(output);
      } catch {
        // ignore
      }
    }
    throw error;
  }

  if (!target.buffer || target.buffer.byteLength < 64) {
    throw new Error("Das erzeugte Video ist leer.");
  }

  const mimeType = codec.container === "mp4" ? "video/mp4" : "video/webm";
  const ext = codec.container === "mp4" ? "mp4" : "webm";
  return {
    blob: new Blob([target.buffer], { type: mimeType }),
    filename: `${slugify(job.fileBaseName)}.${ext}`,
    mimeType,
  };
}

async function exportWithWhammy(
  job: ExportJob,
  canvas: AnyCanvas,
  ctx: AnyCtx,
  width: number,
  height: number,
  onProgress: (percent: number, label: string) => void,
): Promise<ExportResult> {
  const { totalMs } = getPlaybackPlan(job.keyframes);
  const frameCount = getExportFrameCount(job.keyframes, job.fps);
  const label = "Video wird gerendert";
  const webpFrames: string[] = [];

  for (let i = 0; i < frameCount; i++) {
    const elapsedMs = getFrameTimeMs(i, job.fps, totalMs);
    drawExportFrame(
      ctx,
      width,
      height,
      getElementsAtTime(job.keyframes, elapsedMs),
      job.fieldView,
      job.fieldRotation,
    );
    webpFrames.push(await canvasToWebpDataUrl(canvas));
    onProgress(Math.round(((i + 1) / frameCount) * 100), label);
    await yieldUnthrottled();
  }

  onProgress(100, "Video wird fertiggestellt…");
  const encoded = tsWhammy.fromImageArray(webpFrames, job.fps);
  const blob =
    encoded instanceof Blob
      ? encoded.type
        ? encoded
        : new Blob([encoded], { type: "video/webm" })
      : new Blob([encoded as BlobPart], { type: "video/webm" });

  if (blob.size < 64) {
    throw new Error("Das erzeugte Video ist leer.");
  }

  return {
    blob,
    filename: `${slugify(job.fileBaseName)}.webm`,
    mimeType: "video/webm",
  };
}

export async function runExportJob(
  job: ExportJob,
  onProgress: (percent: number, label: string) => void,
): Promise<ExportResult> {
  const { totalMs } = getPlaybackPlan(job.keyframes);
  if (totalMs <= 0) {
    throw new Error("Mindestens zwei Schritte mit Inhalt werden für den Export benötigt.");
  }

  const isGif = job.format === "gif";
  const width = even(isGif ? EXPORT_GIF_WIDTH : EXPORT_VIDEO_WIDTH);
  const height = even(isGif ? EXPORT_GIF_HEIGHT : EXPORT_VIDEO_HEIGHT);
  const { canvas, ctx } = createExportCanvas(width, height);
  const gifLabel = "GIF wird gerendert";

  if (isGif) {
    return exportGifJob(job, canvas, width, height, onProgress, gifLabel);
  }

  try {
    return await exportWithWebCodecs(job, canvas, ctx, width, height, onProgress);
  } catch {
    try {
      return await exportWithWhammy(job, canvas, ctx, width, height, onProgress);
    } catch {
      onProgress(0, "Video nicht unterstützt – GIF wird erstellt…");
      const gif = await exportGifJob(
        { ...job, format: "gif", fps: GIF_EXPORT_FPS },
        canvas,
        even(EXPORT_GIF_WIDTH),
        even(EXPORT_GIF_HEIGHT),
        onProgress,
        "Video nicht unterstützt – GIF wird erstellt…",
      );
      return { ...gif, usedGifFallback: true };
    }
  }
}
