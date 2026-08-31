import { runExportJob } from "./exportEngine";
import {
  EXPORT_GIF_HEIGHT,
  EXPORT_GIF_WIDTH,
  EXPORT_VIDEO_HEIGHT,
  EXPORT_VIDEO_WIDTH,
  GIF_EXPORT_FPS,
  VIDEO_EXPORT_FPS,
  type ExportFormat,
  type ExportJob,
  type ExportResult,
  type ExportWorkerMessage,
  type ExportWorkerRequest,
} from "./exportShared";
import { getPlaybackPlan, type FieldRotation, type FieldView, type Keyframe } from "./types";

export {
  EXPORT_FPS,
  EXPORT_GIF_HEIGHT,
  EXPORT_GIF_WIDTH,
  EXPORT_VIDEO_HEIGHT,
  EXPORT_VIDEO_WIDTH,
  GIF_EXPORT_FPS,
  VIDEO_EXPORT_FPS,
  getElementsAtTime,
  getExportFrameCount,
  getFrameTimeMs,
} from "./exportShared";

export type { ExportFormat, ExportResult };

export interface ExportAnimationOptions {
  keyframes: Keyframe[];
  fieldView: FieldView;
  fieldRotation: FieldRotation;
  format: ExportFormat;
  fileBaseName: string;
  fps?: number;
  onProgress?: (percent: number, label: string) => void;
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

/** Verhindert, dass Chrome den Tab nach wenigen Minuten intensiv drosselt. */
function startBackgroundKeepAlive(): () => void {
  const cleanups: Array<() => void> = [];

  try {
    const silentWav =
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    const audio = new Audio(silentWav);
    audio.loop = true;
    audio.volume = 0.01;
    void audio.play().catch(() => undefined);
    cleanups.push(() => {
      audio.pause();
      audio.src = "";
    });
  } catch {
    // Audio-Keepalive optional
  }

  try {
    const wakeLock = navigator.wakeLock;
    if (wakeLock?.request) {
      void wakeLock.request("screen").then((sentinel) => {
        cleanups.push(() => {
          void sentinel.release();
        });
      });
    }
  } catch {
    // Wake Lock optional
  }

  return () => {
    for (const stop of cleanups) {
      try {
        stop();
      } catch {
        // ignore
      }
    }
  };
}

function createExportWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./exportWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

function runInWorker(job: ExportJob, onProgress?: (percent: number, label: string) => void) {
  return new Promise<ExportResult>((resolve, reject) => {
    const worker = createExportWorker();
    if (!worker) {
      reject(new Error("Worker nicht verfügbar."));
      return;
    }

    const request: ExportWorkerRequest = { type: "start", ...job };
    const timeout = window.setTimeout(
      () => {
        worker.terminate();
        reject(new Error("Export ist abgelaufen."));
      },
      45 * 60 * 1000,
    );

    worker.onmessage = (event: MessageEvent<ExportWorkerMessage>) => {
      const message = event.data;
      if (!message) return;
      if (message.type === "progress") {
        onProgress?.(message.percent, message.label);
        return;
      }
      window.clearTimeout(timeout);
      worker.terminate();
      if (message.type === "error") {
        reject(new Error(message.message));
        return;
      }
      resolve({
        blob: new Blob([message.buffer], { type: message.mimeType }),
        filename: message.filename,
        mimeType: message.mimeType,
        usedGifFallback: message.usedGifFallback,
      });
    };

    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || "Export-Worker ist abgestürzt."));
    };

    worker.postMessage(request);
  });
}

export async function exportTacticsAnimation({
  keyframes,
  fieldView,
  fieldRotation,
  format,
  fileBaseName,
  fps: fpsOverride,
  onProgress,
}: ExportAnimationOptions): Promise<ExportResult> {
  const { totalMs } = getPlaybackPlan(keyframes);
  if (totalMs <= 0) {
    throw new Error("Mindestens zwei Schritte mit Inhalt werden für den Export benötigt.");
  }

  const job: ExportJob = {
    keyframes,
    fieldView,
    fieldRotation,
    format,
    fileBaseName,
    fps: fpsOverride ?? (format === "gif" ? GIF_EXPORT_FPS : VIDEO_EXPORT_FPS),
  };

  const stopKeepAlive = startBackgroundKeepAlive();
  const startLabel = format === "gif" ? "GIF wird gerendert" : "Video wird gerendert";
  onProgress?.(0, startLabel);

  try {
    let result: ExportResult;
    try {
      result = await runInWorker(job, onProgress);
    } catch (workerError) {
      console.warn("[export] Worker-Export nicht möglich, fallback auf Hauptthread:", workerError);
      result = await runExportJob(job, (percent, label) => onProgress?.(percent, label));
    }

    downloadBlob(result.blob, result.filename);
    return result;
  } finally {
    stopKeepAlive();
  }
}
