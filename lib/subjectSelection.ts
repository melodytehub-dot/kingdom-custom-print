import { encodeCanvasUnder } from "./design";
import type { SubjectBox, SubjectMask, SubjectPoint, SubjectSelectionProgress } from "./subjectSelectionInference";

export type { SubjectBox, SubjectMask, SubjectPoint, SubjectSelectionProgress } from "./subjectSelectionInference";

type WorkerResponse =
  | { type: "progress"; id: number; progress: SubjectSelectionProgress }
  | ({ type: "result"; id: number } & SubjectMask)
  | { type: "error"; id: number; message: string };

type PendingRequest = {
  onProgress?: (progress: SubjectSelectionProgress) => void;
  resolve: (mask: SubjectMask) => void;
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
  worker = new Worker(new URL("./subjectSelection.worker.ts", import.meta.url), { type: "module" });
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
    request.resolve({ width: message.width, height: message.height, mask: message.mask });
  };
  worker.onerror = (event) => failWorker(new Error(event.message || "The object-selection worker stopped unexpectedly."));
  worker.onmessageerror = () => failWorker(new Error("The object-selection result could not be read."));
  return worker;
}

export function selectSubject(
  src: string,
  points: SubjectPoint[],
  onProgress?: (progress: SubjectSelectionProgress) => void,
  box?: SubjectBox,
): Promise<SubjectMask> {
  const id = ++nextRequestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { onProgress, resolve, reject });
    try {
      getWorker().postMessage({ id, src, points, box });
    } catch (error) {
      pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error("Could not start object selection."));
    }
  });
}

export async function createSubjectCutout(src: string, selection: SubjectMask): Promise<string> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await image.decode();

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Your browser could not prepare the selected object.");
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const alpha = new Uint8Array(selection.mask);
  const sameSize = selection.width === width && selection.height === height;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const maskY = sameSize ? y : Math.min(selection.height - 1, Math.floor((y / height) * selection.height));
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const maskX = sameSize ? x : Math.min(selection.width - 1, Math.floor((x / width) * selection.width));
      const outputAlpha = Math.round((pixels.data[pixel * 4 + 3] * alpha[maskY * selection.width + maskX]) / 255);
      pixels.data[pixel * 4 + 3] = outputAlpha;
      if (outputAlpha > 16) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  context.putImageData(pixels, 0, 0);
  if (right < left || bottom < top) throw new Error("No clear object was found. Add another Keep point and try again.");

  const padding = Math.max(4, Math.round(Math.max(right - left, bottom - top) * 0.025));
  const cropLeft = Math.max(0, left - padding);
  const cropTop = Math.max(0, top - padding);
  const cropWidth = Math.min(width - cropLeft, right - left + padding * 2 + 1);
  const cropHeight = Math.min(height - cropTop, bottom - top + padding * 2 + 1);
  const cropped = document.createElement("canvas");
  cropped.width = cropWidth;
  cropped.height = cropHeight;
  const croppedContext = cropped.getContext("2d");
  if (!croppedContext) throw new Error("Your browser could not trim the transparent edges.");
  croppedContext.drawImage(canvas, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return encodeCanvasUnder(cropped).dataUrl;
}
