import { predictSubjectMask, type SubjectBox, type SubjectPoint, type SubjectSelectionProgress } from "./subjectSelectionInference";

self.onmessage = async (event: MessageEvent<{ id: number; src: string; points: SubjectPoint[]; box?: SubjectBox }>) => {
  const { id, src, points, box } = event.data;
  try {
    const result = await predictSubjectMask(src, points, (progress: SubjectSelectionProgress) => {
      self.postMessage({ type: "progress", id, progress });
    }, box);
    self.postMessage({ type: "result", id, ...result }, { transfer: [result.mask] });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message: error instanceof Error ? error.message : "Object selection failed.",
    });
  }
};
