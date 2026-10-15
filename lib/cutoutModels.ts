/**
 * The models behind "Remove Background".
 *
 * Background removal is two very different jobs, so there are two models:
 *
 *  - **Portrait matting** (`Xenova/modnet`, 6 MB) is the one the customer
 *    normally meets. It is tiny, runs on a phone's own CPU, and is trained to
 *    matte a person — which is what gets printed on a shirt — so hair, fur and
 *    soft edges survive. That is the whole reason a photo cut-out looked better
 *    than "cut around the outside of the picture".
 *  - **General segmentation** (`briaai/RMBG-1.4`, 42 MB) is the safety net for
 *    everything a person-model gets wrong: mugs, pets, group shots where the
 *    portrait model loses the subject. It is only downloaded when the portrait
 *    model's mask fails the checks in `lib/cutoutMask.ts`, so most customers
 *    never pay for it.
 *
 * Everything runs on-device in a Web Worker. No API keys, no per-image cost,
 * no photo leaving the browser.
 *
 * Sizes are the quantised (`q8`) weights, measured from the Hub; the portrait
 * model is deliberately 4x smaller than its full-precision twin because it is
 * the one that has to be fair over a phone's data connection.
 */
export type CutoutModelKind = "portrait" | "general";

export interface CutoutModelSpec {
  /** Hugging Face repository id. */
  id: string;
  /** How the model is described to the customer while it downloads. */
  name: string;
  /** Quantised weights — the only size worth shipping to a phone. */
  dtype: "q8";
  /** Download size in bytes, for honest progress copy. */
  bytes: number;
  /** What the model is good at; also what lands on the layer. */
  kind: CutoutModelKind;
}

export const PORTRAIT_MODEL: CutoutModelSpec = {
  id: "Xenova/modnet",
  name: "portrait",
  dtype: "q8",
  bytes: 6_300_000,
  kind: "portrait",
};

export const GENERAL_MODEL: CutoutModelSpec = {
  id: "briaai/RMBG-1.4",
  name: "detailed",
  dtype: "q8",
  bytes: 42_300_000,
  kind: "general",
};

/** Tried in order: cheapest model that can do the job first. */
export const CUTOUT_MODELS: CutoutModelSpec[] = [PORTRAIT_MODEL, GENERAL_MODEL];

/** The general model on its own — what the "detailed model" button asks for. */
export const DETAILED_PLAN: CutoutModelKind[] = [GENERAL_MODEL.kind];

/**
 * Which models a device should run.
 *
 * A phone only gets the portrait model: the general model is 42 MB and takes
 * tens of seconds of CPU on a phone, which is not a wait anyone should be put
 * through without asking. Desktop browsers, where that download and the CPU
 * are both affordable, get the automatic fallback so a mug or a pet still comes
 * out cleanly. Either way the customer can ask for the detailed model by hand
 * (`removeBackgroundLocally` with `plan: DETAILED_PLAN`).
 */
export function cutoutPlan(allowDetailed: boolean): CutoutModelKind[] {
  return allowDetailed ? CUTOUT_MODELS.map((model) => model.kind) : [PORTRAIT_MODEL.kind];
}

/**
 * Largest edge the cutout works at. Bigger uploads are masked at a reduced
 * resolution and the mask is scaled back up, which bounds the work on a phone
 * (a 12 megapixel upload is ~48 MB of pixels) without softening the print.
 */
export const CUTOUT_MAX_EDGE = 1400;

/** "6 MB" / "42 MB", for progress copy the customer can act on. */
export function formatModelSize(bytes: number): string {
  const mb = bytes / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`;
}
