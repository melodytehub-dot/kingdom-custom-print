import type { ProgressInfo, RawImage as RawImageClass, Tensor } from "@huggingface/transformers";
import { analyseMask, maskIsUsable, polishMask, type MaskReport } from "./cutoutMask";
import { CUTOUT_MAX_EDGE, CUTOUT_MODELS, type CutoutModelKind, type CutoutModelSpec } from "./cutoutModels";

/**
 * On-device background removal for uploaded photos.
 *
 * Runs inside `backgroundRemoval.worker.ts` (never on the main thread) and tries
 * the models in `lib/cutoutModels.ts` in order. After every attempt the mask is
 * measured by `lib/cutoutMask.ts`; a mask that found nothing, kept everything or
 * punched holes through the subject is thrown away and the next model gets its
 * turn. That is what turns "it just cropped out the whole picture" into either
 * a clean cut-out or an honest message.
 *
 * Everything is WASM on the customer's own device: no API keys, no per-image
 * cost, and the photo never leaves the browser.
 */

export interface BackgroundRemovalProgress {
  phase: "download" | "processing";
  /** 0-100 while `phase` is "download". */
  percent?: number;
  /** 1 = the portrait model, 2 = the detailed fallback. */
  attempt?: number;
  /** Which model is working, so the copy can say what is downloading. */
  model?: CutoutModelSpec;
}

/** Why a cutout could not be produced, so the customer gets the right advice. */
export type CutoutFailure = "unavailable" | "no-subject";

export class CutoutError extends Error {
  readonly reason: CutoutFailure;

  constructor(reason: CutoutFailure, message: string) {
    super(message);
    this.name = "CutoutError";
    this.reason = reason;
  }
}

export type BackgroundRemovalPixels = {
  width: number;
  height: number;
  pixels: ArrayBuffer;
  /** Which model won. */
  kind: CutoutModelKind;
  /** What the mask looked like; `reject` is set when nothing better was found. */
  report: MaskReport;
};

type LoadedModel = {
  model: Awaited<ReturnType<typeof import("@huggingface/transformers")["AutoModel"]["from_pretrained"]>>;
  processor: Awaited<ReturnType<typeof import("@huggingface/transformers")["AutoProcessor"]["from_pretrained"]>>;
  inputNames: string[];
  outputNames: string[];
};

type Attempt = BackgroundRemovalPixels & { spec: CutoutModelSpec };

/** Models stay resident in the worker, so the second cut-out is instant. */
const loadedModels = new Map<string, Promise<LoadedModel>>();

async function loadModel(
  spec: CutoutModelSpec,
  attempt: number,
  onProgress?: (progress: BackgroundRemovalProgress) => void,
): Promise<LoadedModel> {
  const cached = loadedModels.get(spec.id);
  if (cached) return cached;

  const pending = (async () => {
    const { AutoModel, AutoProcessor } = await import("@huggingface/transformers");
    const progress_callback = (info: ProgressInfo) => {
      if (info.status === "progress_total") {
        onProgress?.({ phase: "download", percent: Math.round(info.progress), attempt, model: spec });
      }
    };
    const [model, processor] = await Promise.all([
      AutoModel.from_pretrained(spec.id, { device: "wasm", dtype: spec.dtype, progress_callback }),
      AutoProcessor.from_pretrained(spec.id),
    ]);
    const sessions = (model as unknown as { sessions?: Record<string, { inputNames?: string[]; outputNames?: string[] }> })
      .sessions;
    const session = sessions?.model ?? (sessions ? Object.values(sessions)[0] : undefined);
    return {
      model,
      processor,
      inputNames: session?.inputNames ?? [],
      outputNames: session?.outputNames ?? [],
    };
  })();

  loadedModels.set(spec.id, pending);
  try {
    return await pending;
  } catch (error) {
    loadedModels.delete(spec.id);
    throw error;
  }
}

/** A decoded picture at working resolution, capped so phones never blow up. */
async function readWorkImage(src: string, maxEdge: number): Promise<RawImageClass> {
  const { RawImage } = await import("@huggingface/transformers");
  const fit = (width: number, height: number) => {
    const scale = Math.min(1, maxEdge / Math.max(1, width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  };
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    // Decoding straight to the working size keeps a 12 megapixel upload from
    // materialising twice inside the worker.
    const bitmap = await createImageBitmap(blob);
    try {
      const size = fit(bitmap.width, bitmap.height);
      const canvas = new OffscreenCanvas(size.width, size.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not prepare that photo.");
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      return new RawImage(context.getImageData(0, 0, size.width, size.height).data, size.width, size.height, 4);
    } finally {
      bitmap.close?.();
    }
  } catch {
    const image = await RawImage.read(src);
    const size = fit(image.width, image.height);
    if (size.width === image.width && size.height === image.height) return image;
    return image.resize(size.width, size.height, { resample: "bilinear" });
  }
}

function isTensor(value: unknown): value is Tensor {
  return Boolean(value) && typeof (value as Tensor).dims !== "undefined";
}

/** The mask models output a batch of one; indexing is runtime-only in the types. */
function firstOfBatch(tensor: Tensor): Tensor {
  return (tensor as unknown as Record<number, Tensor>)[0];
}

/** Models disagree: some emit probabilities, some emit logits. */
function toProbabilities(tensor: Tensor): Tensor {
  const data = tensor.data;
  for (let i = 0; i < data.length; i += 97) {
    if (data[i] < -0.00001 || data[i] > 1.00001) return tensor.sigmoid();
  }
  return tensor;
}

async function runModel(
  spec: CutoutModelSpec,
  image: RawImageClass,
  attempt: number,
  onProgress?: (progress: BackgroundRemovalProgress) => void,
): Promise<Attempt> {
  const { RawImage } = await import("@huggingface/transformers");
  const { model, processor, inputNames, outputNames } = await loadModel(spec, attempt, onProgress);
  onProgress?.({ phase: "processing", attempt, model: spec });

  const inputs = (await processor(image)) as unknown as Record<string, { dims?: unknown }>;
  const first = inputs.pixel_values ?? Object.values(inputs)[0];
  const feed: Record<string, unknown> = {};
  const names = inputNames.length ? inputNames : ["pixel_values"];
  for (const name of names) feed[name] = inputs[name] ?? first;

  const output = (await model(feed as never)) as unknown as Record<string, unknown>;
  let tensor = outputNames.length ? output[outputNames[0]] : undefined;
  if (!isTensor(tensor)) tensor = Object.values(output).find(isTensor);
  if (!isTensor(tensor)) throw new CutoutError("unavailable", "The cut-out model returned nothing.");

  const flat = toProbabilities(tensor);
  const single = tensor.dims.length >= 4 ? firstOfBatch(flat) : flat;
  const lowResolution = RawImage.fromTensor(single.mul(255).to("uint8"));
  const resized = await lowResolution.resize(image.width, image.height, { resample: "bilinear" });

  const alpha = Uint8Array.from(resized.data);
  polishMask(alpha);
  const report = analyseMask(alpha, image.width, image.height);

  const composed = image.clone();
  composed.putAlpha(new RawImage(alpha, image.width, image.height, 1));

  return {
    spec,
    report,
    kind: spec.kind,
    width: image.width,
    height: image.height,
    pixels: new Uint8ClampedArray(composed.data).buffer,
  };
}

/** Ranked so that "structure is right but has holes" beats "found nothing". */
function rank(report: MaskReport): number {
  if (maskIsUsable(report)) return 3;
  return report.reject === "holes" ? 2 : report.reject === "mush" ? 1 : 0;
}

/**
 * Removes the background from an uploaded picture.
 *
 * `plan` names the models to try, in order (see `lib/cutoutModels.ts`).
 * Returns the cut-out pixels plus the report of the mask that won. Throws a
 * `CutoutError` only when no model produced anything usable, with the reason
 * the customer-facing copy is built from.
 */
export async function removeBackgroundPixels(
  src: string,
  options: {
    maxEdge?: number;
    plan?: CutoutModelKind[];
    onProgress?: (progress: BackgroundRemovalProgress) => void;
  } = {},
): Promise<BackgroundRemovalPixels> {
  const { maxEdge = CUTOUT_MAX_EDGE, plan, onProgress } = options;
  const models = plan?.length
    ? CUTOUT_MODELS.filter((spec) => plan.includes(spec.kind))
    : CUTOUT_MODELS;
  const image = await readWorkImage(src, maxEdge);

  let best: Attempt | null = null;
  let failure: unknown = null;
  for (let i = 0; i < models.length; i++) {
    const spec = models[i];
    try {
      const attempt = await runModel(spec, image, i + 1, onProgress);
      if (maskIsUsable(attempt.report)) return attempt;
      if (!best || rank(attempt.report) > rank(best.report)) best = attempt;
    } catch (error) {
      failure = error;
    }
  }

  if (best && rank(best.report) > 0) return best;
  if (best) throw new CutoutError("no-subject", "We could not find a subject in that photo.");
  throw new CutoutError(
    "unavailable",
    failure instanceof Error ? failure.message : "The cut-out model could not be loaded.",
  );
}
