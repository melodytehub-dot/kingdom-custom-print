import type { ProgressInfo, Tensor } from "@huggingface/transformers";

const MODEL_ID = "Xenova/slimsam-77-uniform";

export interface SubjectPoint {
  x: number;
  y: number;
  label: 0 | 1;
}

export interface SubjectBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SubjectSelectionProgress {
  phase: "download" | "prepare" | "segment";
  percent?: number;
}

export interface SubjectMask {
  width: number;
  height: number;
  mask: ArrayBuffer;
}

type PreparedImage = {
  pixel_values: Tensor;
  original_sizes: [number, number][];
  reshaped_input_sizes: [number, number][];
};

type PromptProcessor = ((image: unknown) => Promise<PreparedImage>) & {
  reshape_input_points(
    points: number[][][][] | number[][][],
    originalSizes: [number, number][],
    reshapedSizes: [number, number][],
    isBoundingBox?: boolean,
  ): Tensor;
  post_process_masks(
    masks: Tensor,
    originalSizes: [number, number][],
    reshapedSizes: [number, number][],
    options: { binarize: boolean },
  ): Promise<Tensor[]>;
};

type SegmentationModel = {
  get_image_embeddings(input: { pixel_values: Tensor }): Promise<{
    image_embeddings: Tensor;
    image_positional_embeddings: Tensor;
  }>;
  (input: Record<string, Tensor>): Promise<{ pred_masks: Tensor; iou_scores: Tensor }>;
};

type LoadedModel = { model: SegmentationModel; processor: PromptProcessor };

let modelPromise: Promise<LoadedModel> | null = null;
let cachedSource: string | null = null;
let cachedSizes: Pick<PreparedImage, "original_sizes" | "reshaped_input_sizes"> | null = null;
let cachedEmbeddings: Awaited<ReturnType<SegmentationModel["get_image_embeddings"]>> | null = null;

async function loadModel(onProgress?: (progress: SubjectSelectionProgress) => void): Promise<LoadedModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { AutoProcessor, SamModel } = await import("@huggingface/transformers");
      const progress_callback = (info: ProgressInfo) => {
        if (info.status === "progress_total") {
          onProgress?.({ phase: "download", percent: Math.round(info.progress) });
        }
      };
      const [rawModel, rawProcessor] = await Promise.all([
        SamModel.from_pretrained(MODEL_ID, { progress_callback }),
        AutoProcessor.from_pretrained(MODEL_ID),
      ]);
      return {
        model: rawModel as unknown as SegmentationModel,
        processor: rawProcessor as unknown as PromptProcessor,
      };
    })();
  }

  try {
    return await modelPromise;
  } catch (error) {
    modelPromise = null;
    throw error;
  }
}

export async function predictSubjectMask(
  src: string,
  points: SubjectPoint[],
  onProgress?: (progress: SubjectSelectionProgress) => void,
  box?: SubjectBox,
): Promise<SubjectMask> {
  if (!box && !points.some((point) => point.label === 1)) {
    throw new Error("Tap the object you want to keep first.");
  }

  const [{ RawImage, Tensor }, { model, processor }] = await Promise.all([
    import("@huggingface/transformers"),
    loadModel(onProgress),
  ]);

  if (cachedSource !== src || !cachedSizes || !cachedEmbeddings) {
    onProgress?.({ phase: "prepare" });
    const image = await RawImage.read(src);
    const prepared = await processor(image);
    cachedEmbeddings = await model.get_image_embeddings({ pixel_values: prepared.pixel_values });
    cachedSizes = {
      original_sizes: prepared.original_sizes,
      reshaped_input_sizes: prepared.reshaped_input_sizes,
    };
    cachedSource = src;
  }

  onProgress?.({ phase: "segment" });
  const [height, width] = cachedSizes.original_sizes[0];
  const inferencePoints = points.length
    ? points
    : box
      ? [{ x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 }]
      : [];
  const labels = points.length ? points.map(({ label }) => label) : [1];
  const imagePoints = inferencePoints.map(({ x, y }) => [
    Math.min(width - 1, Math.max(0, x * width)),
    Math.min(height - 1, Math.max(0, y * height)),
  ]);
  const input_points = processor.reshape_input_points(
    [[imagePoints]],
    cachedSizes.original_sizes,
    cachedSizes.reshaped_input_sizes,
  );
  const input_labels = new Tensor(
    "int64",
    BigInt64Array.from(labels.map((label) => BigInt(label))),
    [1, 1, labels.length],
  );
  const input_boxes = box
    ? processor.reshape_input_points(
        [[[
          box.x1 * width,
          box.y1 * height,
          box.x2 * width,
          box.y2 * height,
        ]]],
        cachedSizes.original_sizes,
        cachedSizes.reshaped_input_sizes,
        true,
      )
    : null;
  const modelInputs = { ...cachedEmbeddings, input_points, input_labels };
  const output = await model(input_boxes ? { ...modelInputs, input_boxes } : modelInputs);
  const masks = await processor.post_process_masks(
    output.pred_masks,
    cachedSizes.original_sizes,
    cachedSizes.reshaped_input_sizes,
    { binarize: false },
  );

  const maskTensor = masks[0];
  const [, candidateCount, maskHeight, maskWidth] = maskTensor.dims;
  const candidatePixels = maskHeight * maskWidth;
  const scores = output.iou_scores.data;
  let bestCandidate = 0;
  for (let candidate = 1; candidate < candidateCount; candidate++) {
    if (Number(scores[candidate]) > Number(scores[bestCandidate])) bestCandidate = candidate;
  }

  const values = maskTensor.data;
  const mask = new Uint8Array(candidatePixels);
  const start = bestCandidate * candidatePixels;
  for (let pixel = 0; pixel < candidatePixels; pixel++) {
    const logit = Number(values[start + pixel]);
    mask[pixel] = Math.round(Math.min(1, Math.max(0, (logit + 1) / 2)) * 255);
  }

  return { width: maskWidth, height: maskHeight, mask: mask.buffer };
}
