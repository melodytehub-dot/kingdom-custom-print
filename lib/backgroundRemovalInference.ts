import type { AutoModel, AutoProcessor, ProgressInfo } from "@huggingface/transformers";

const MODEL_ID = "studioludens/birefnet-lite-512";

export interface BackgroundRemovalProgress {
  phase: "prepare" | "download" | "processing" | "compatibility";
  percent?: number;
}

type LoadedModel = {
  model: Awaited<ReturnType<typeof AutoModel.from_pretrained>>;
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
  device: "webgpu" | "wasm";
};

type ModelCandidate = { device: "webgpu" | "wasm"; dtype: "fp16" | "fp32" };

export type BackgroundRemovalPixels = {
  width: number;
  height: number;
  pixels: ArrayBuffer;
};

let modelPromise: Promise<LoadedModel> | null = null;

function isConstrainedDevice() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const iPadOs = typeof navigator !== "undefined"
    && /Macintosh/i.test(userAgent)
    && navigator.maxTouchPoints > 1;
  const deviceMemory = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || iPadOs || (deviceMemory !== undefined && deviceMemory <= 4);
}

async function disposeModel(loaded: LoadedModel) {
  try {
    await loaded.model.dispose();
  } catch {
    // Some browser runtimes release the session themselves after an execution error.
  }
}

async function loadModel(
  onProgress?: (progress: BackgroundRemovalProgress) => void,
  wasmOnly = false,
) {
  if (!modelPromise) {
    modelPromise = (async () => {
      const gpu = (navigator as unknown as {
        gpu?: { requestAdapter: () => Promise<{ features: { has: (feature: string) => boolean } } | null> };
      }).gpu;
      let adapter: Awaited<ReturnType<NonNullable<typeof gpu>["requestAdapter"]>> = null;
      if (gpu && !wasmOnly) {
        try {
          adapter = await gpu.requestAdapter();
        } catch {
          adapter = null;
        }
      }
      const { AutoModel, AutoProcessor } = await import("@huggingface/transformers");
      const progress_callback = (info: ProgressInfo) => {
        if (info.status === "progress_total") {
          onProgress?.({ phase: "download", percent: Math.round(info.progress) });
        }
      };
      const candidates: ModelCandidate[] = adapter
        ? [{ device: "webgpu", dtype: adapter.features.has("shader-f16") ? "fp16" : "fp32" }]
        : [];
      candidates.push({ device: "wasm", dtype: "fp32" });

      let lastError: unknown;
      for (const candidate of candidates) {
        if (candidate.device === "wasm") onProgress?.({ phase: "compatibility" });
        try {
          const [model, processor] = await Promise.all([
            AutoModel.from_pretrained(MODEL_ID, {
              device: candidate.device,
              dtype: candidate.dtype,
              progress_callback,
            }),
            AutoProcessor.from_pretrained(MODEL_ID),
          ]);
          return { model, processor, device: candidate.device };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("The background-removal model could not be loaded.");
    })();
  }

  try {
    return await modelPromise;
  } catch (error) {
    modelPromise = null;
    throw error;
  }
}

export async function removeBackgroundPixels(
  src: string,
  onProgress?: (progress: BackgroundRemovalProgress) => void,
): Promise<BackgroundRemovalPixels> {
  const { RawImage } = await import("@huggingface/transformers");
  const constrainedDevice = isConstrainedDevice();
  onProgress?.({ phase: "prepare" });
  const image = await RawImage.read(src);
  let activeModel: LoadedModel = await loadModel(onProgress);
  try {
    const { pixel_values } = await activeModel.processor(image);
    onProgress?.({ phase: "processing" });
    let output;
    try {
      output = await activeModel.model({ input_image: pixel_values });
    } catch (error) {
      if (activeModel.device !== "webgpu") throw error;
      const failedGpuModel = activeModel;
      if (modelPromise) modelPromise = null;
      await disposeModel(failedGpuModel);
      onProgress?.({ phase: "compatibility" });
      activeModel = await loadModel(onProgress, true);
      output = await activeModel.model({ input_image: pixel_values });
    }

    const logits = output.output_image;
    if (!logits) throw new Error("The background-removal model returned no mask.");

    const lowResolutionMask = RawImage.fromTensor(logits[0].sigmoid().mul(255).to("uint8"));
    const mask = await lowResolutionMask.resize(image.width, image.height, { resample: "bilinear" });
    const rgba = image.rgba();
    const sourceAlpha = rgba.channels === 4
      ? Uint8Array.from({ length: rgba.width * rgba.height }, (_, i) => rgba.data[i * 4 + 3])
      : null;
    rgba.putAlpha(mask);
    if (sourceAlpha) {
      for (let i = 0; i < sourceAlpha.length; i++) {
        rgba.data[i * 4 + 3] = Math.round((rgba.data[i * 4 + 3] * sourceAlpha[i]) / 255);
      }
    }

    return {
      width: rgba.width,
      height: rgba.height,
      pixels: new Uint8ClampedArray(rgba.data).buffer,
    };
  } finally {
    if (constrainedDevice) {
      await disposeModel(activeModel);
      modelPromise = null;
    }
  }
}
