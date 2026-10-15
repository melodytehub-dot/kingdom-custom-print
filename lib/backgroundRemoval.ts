import { encodeCanvasUnder } from "./design";
import type { CutoutSource } from "./types";
import type { BackgroundRemovalProgress, CutoutFailure } from "./backgroundRemovalInference";
import type { MaskReport } from "./cutoutMask";
import type { CutoutModelKind } from "./cutoutModels";

export type { BackgroundRemovalProgress, CutoutFailure } from "./backgroundRemovalInference";
export type { MaskReport } from "./cutoutMask";
export { CutoutError } from "./backgroundRemovalInference";

type WorkerResponse =
  | { type: "progress"; id: number; progress: BackgroundRemovalProgress }
  | {
      type: "result";
      id: number;
      width: number;
      height: number;
      pixels: ArrayBuffer;
      kind: CutoutModelKind;
      report: MaskReport;
    }
  | { type: "error"; id: number; message: string; reason?: CutoutFailure };

export interface CutoutResult {
  dataUrl: string;
  /** Which model produced it, recorded on the layer. */
  source: CutoutSource;
  /** How the mask measured up; `reject` is set when it is a best effort. */
  report: MaskReport;
}

type PendingRequest = {
  onProgress?: (progress: BackgroundRemovalProgress) => void;
  resolve: (result: CutoutResult) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, PendingRequest>();

function failWorker(error: Error) {
  worker?.terminate();
  worker = null;
  for (const request of pendingRequests.values()) request.reject(error);
  pendingRequests.clear();
}

function getWorker() {
  if (worker) return worker;

  worker = new Worker(new URL("./backgroundRemoval.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const request = pendingRequests.get(message.id);
    if (!request) return;

    if (message.type === "progress") {
      request.onProgress?.(message.progress);
      return;
    }
    pendingRequests.delete(message.id);
    if (message.type === "error") {
      const error = new Error(message.message) as Error & { reason?: CutoutFailure };
      error.reason = message.reason;
      request.reject(error);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = message.width;
    canvas.height = message.height;
    const context = canvas.getContext("2d");
    if (!context) {
      request.reject(new Error("Your browser could not prepare the background-removed image."));
      return;
    }
    context.putImageData(new ImageData(new Uint8ClampedArray(message.pixels), message.width, message.height), 0, 0);
    request.resolve({
      dataUrl: encodeCanvasUnder(canvas).dataUrl,
      source: message.kind,
      report: message.report,
    });
  };
  worker.onerror = (event) => failWorker(new Error(event.message || "The background-removal worker stopped unexpectedly."));
  worker.onmessageerror = () => failWorker(new Error("The background-removal result could not be read."));
  return worker;
}

/**
 * Cuts the subject out of a photo with the on-device models.
 *
 * `plan` names the models to try, in order: the portrait model by default, the
 * 42 MB general model on top of it on devices that can afford it, or the
 * general model alone for the "detailed model" button.
 */
export function removeBackgroundLocally(
  src: string,
  options: {
    onProgress?: (progress: BackgroundRemovalProgress) => void;
    maxEdge?: number;
    plan?: CutoutModelKind[];
  } = {},
): Promise<CutoutResult> {
  const { onProgress, maxEdge, plan } = options;
  const id = ++nextRequestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { onProgress, resolve, reject });
    try {
      getWorker().postMessage({ id, src, maxEdge, plan });
    } catch (error) {
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error("Could not start background removal."));
    }
  });
}
