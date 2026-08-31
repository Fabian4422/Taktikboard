import { runExportJob } from "./exportEngine";
import type { ExportWorkerMessage, ExportWorkerRequest } from "./exportShared";

function post(message: ExportWorkerMessage, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) {
    self.postMessage(message, { transfer });
  } else {
    self.postMessage(message);
  }
}

self.addEventListener("message", (event: MessageEvent<ExportWorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== "start") return;

  void (async () => {
    try {
      const result = await runExportJob(data, (percent, label) => {
        post({ type: "progress", percent, label });
      });
      const buffer = await result.blob.arrayBuffer();
      post(
        {
          type: "done",
          buffer,
          filename: result.filename,
          mimeType: result.mimeType,
          usedGifFallback: result.usedGifFallback,
        },
        [buffer],
      );
    } catch (error) {
      post({
        type: "error",
        message: error instanceof Error ? error.message : "Export fehlgeschlagen.",
      });
    }
  })();
});
