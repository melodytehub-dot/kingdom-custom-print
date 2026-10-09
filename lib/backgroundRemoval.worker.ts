import { removeBackgroundPixels } from "./backgroundRemovalInference";

self.onmessage = async (event: MessageEvent<{ id: number; src: string }>) => {
  const { id, src } = event.data;
  try {
    const result = await removeBackgroundPixels(src, (progress) => {
      self.postMessage({ type: "progress", id, progress });
    });
    self.postMessage({ type: "result", id, ...result }, { transfer: [result.pixels] });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message: error instanceof Error ? error.message : "Background removal failed.",
    });
  }
};
