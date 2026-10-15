import { removeBackgroundPixels } from "./backgroundRemovalInference";
import type { CutoutModelKind } from "./cutoutModels";

self.onmessage = async (
  event: MessageEvent<{ id: number; src: string; maxEdge?: number; plan?: CutoutModelKind[] }>,
) => {
  const { id, src, maxEdge, plan } = event.data;
  try {
    const result = await removeBackgroundPixels(src, {
      maxEdge,
      plan,
      onProgress: (progress) => {
        self.postMessage({ type: "progress", id, progress });
      },
    });
    self.postMessage({ type: "result", id, ...result }, { transfer: [result.pixels] });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message: error instanceof Error ? error.message : "Background removal failed.",
      reason: (error as { reason?: string })?.reason,
    });
  }
};
