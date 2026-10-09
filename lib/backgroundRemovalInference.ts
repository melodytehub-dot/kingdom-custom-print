import type { AutoModel, AutoProcessor, ProgressInfo } from "@huggingface/transformers";

const MODEL_ID = "studioludens/birefnet-lite-512";

export interface BackgroundRemovalProgress {
  phase: "download" | "processing" | "compatibility";
  percent?: number;
}

type LoadedModel = {
  model: Awaited<ReturnType<typeof AutoModel.from_pretrained>>;
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
};

export type BackgroundRemovalPixels = {
  width: number;
  height: number;
  pixels: ArrayBuffer;
};

let modelPromise: Promise<LoadedModel> | null = null;

async function loadModel(onProgress?: (progress: BackgroundRemovalProgress) => void) {
  if (!modelPromise) {
    modelPromise = (async () => {
      const gpu = (navigator as unknown as {
        gpu?: { requestAdapter: () => Promise<{ features: { has: (feature: string) => boolean } } | null> };
      }).gpu;
      const adapter = await gpu?.requestAdapter();
      const useWebGpu = Boolean(adapter?.features.has("shader-f16"));
      if (!useWebGpu) onProgress?.({ phase: "compatibility" });
      const { AutoModel, AutoProcessor } = await import("@huggingface/transformers");
      const progress_callback = (info: ProgressInfo) => {
        if (info.status === "progress_total") {
          onProgress?.({ phase: "download", percent: Math.round(info.progress) });
        }
      };
      const [model, processor] = await Promise.all([
        AutoModel.from_pretrained(MODEL_ID, {
          device: useWebGpu ? "webgpu" : "wasm",
          dtype: useWebGpu ? "fp16" : "fp32",
          progress_callback,
        }),
        AutoProcessor.from_pretrained(MODEL_ID),
      ]);
      return { model, processor };
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
  const [image, { model, processor }] = await Promise.all([RawImage.read(src), loadModel(onProgress)]);

  onProgress?.({ phase: "processing" });
  const { pixel_values } = await processor(image);
  const output = await model({ input_image: pixel_values });
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
}
