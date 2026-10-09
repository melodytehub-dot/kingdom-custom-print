import { encodeCanvasUnder } from "./design";
import type { BackgroundRemovalProgress } from "./backgroundRemovalInference";

export type { BackgroundRemovalProgress } from "./backgroundRemovalInference";

type WorkerResponse =
  | { type: "progress"; id: number; progress: BackgroundRemovalProgress }
  | { type: "result"; id: number; width: number; height: number; pixels: ArrayBuffer }
  | { type: "error"; id: number; message: string };

type PendingRequest = {
  onProgress?: (progress: BackgroundRemovalProgress) => void;
  resolve: (result: string) => void;
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
      request.reject(new Error(message.message));
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
    request.resolve(encodeCanvasUnder(canvas).dataUrl);
  };
  worker.onerror = (event) => failWorker(new Error(event.message || "The background-removal worker stopped unexpectedly."));
  worker.onmessageerror = () => failWorker(new Error("The background-removal result could not be read."));
  return worker;
}

export function removeBackgroundLocally(
  src: string,
  onProgress?: (progress: BackgroundRemovalProgress) => void,
): Promise<string> {
  const id = ++nextRequestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { onProgress, resolve, reject });
    try {
      getWorker().postMessage({ id, src });
    } catch (error) {
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error("Could not start background removal."));
    }
  });
}
