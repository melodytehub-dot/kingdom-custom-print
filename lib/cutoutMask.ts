/**
 * Mask maths for the AI background cutout.
 *
 * Pure data in, pure data out: no DOM, no model, no worker — so the exact same
 * code runs inside the background-removal worker, in the unit tests and in the
 * model lab. That keeps "is this mask usable?" honest and measurable.
 */

/** Alpha at or below this is treated as background. */
export const MASK_KEEP = 8;
/** Alpha at or above this is treated as solid artwork. */
export const MASK_SOLID = 247;
/** Leftover haze below this is wiped out after the model runs. */
export const MASK_HAZE = 10;

export interface MaskReport {
  /** Share of the picture the mask keeps. */
  coverage: number;
  /** Share of the picture that is solidly kept. */
  solid: number;
  /** Share of the picture that is partly transparent (hair, fur, glass). */
  soft: number;
  /** Share of the kept silhouette that is enclosed background (see below). */
  holes: number;
  /** Set when the mask cannot be trusted, with the reason. */
  reject?: "empty" | "everything" | "holes" | "mush";
}

export interface MaskLimits {
  /** A mask that keeps less than this found nothing. */
  minCoverage: number;
  /** A mask that keeps more than this removed nothing. */
  maxCoverage: number;
  /** Above this share of enclosed background the mask is a sieve. */
  maxHoles: number;
  /** Below this share of solid pixels the mask is haze, not artwork. */
  minSolid: number;
}

/**
 * Calibrated in `scripts/qa-cutout-lab.mjs` against real photos: a person
 * against a busy sea/sky backdrop, a torso close-up, and a mug on a wooden
 * table. Two families of failure have to be caught, because the next model in
 * the plan gets a turn when they are:
 *
 *  - "found nothing" / "kept everything" — the portrait model on a mug photo
 *    kept 0.6% of the picture, which is exactly the "it didn't recognise
 *    anything" complaint;
 *  - "haze" — a mask with no solid core is not artwork, it is a fog.
 *
 * `holes` is deliberately generous. A genuinely enclosed hole is normal artwork
 * (the mug's handle measured 20.6% of its own silhouette), so this only trips
 * on a mask that is mostly holes — a ring around the picture rather than a
 * subject in it.
 */
export const DEFAULT_MASK_LIMITS: MaskLimits = {
  minCoverage: 0.01,
  maxCoverage: 0.97,
  maxHoles: 0.35,
  minSolid: 0.2,
};

/**
 * Measures a single-channel alpha mask.
 *
 * `holes` is the share of the subject's silhouette that is enclosed background:
 * transparency that cannot be reached from the picture's border.
 */
export function analyseMask(
  alpha: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  limits: MaskLimits = DEFAULT_MASK_LIMITS,
): MaskReport {
  const n = width * height;
  const report: MaskReport = { coverage: 0, solid: 0, soft: 0, holes: 0 };
  if (!n) {
    report.reject = "empty";
    return report;
  }

  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const push = (p: number) => {
    if (seen[p] === 0 && alpha[p] <= MASK_KEEP) {
      seen[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (y > 0) push(p - width);
    if (y < height - 1) push(p + width);
  }

  let kept = 0;
  let solid = 0;
  let holePixels = 0;
  for (let p = 0; p < n; p++) {
    const a = alpha[p];
    if (a > MASK_KEEP) {
      kept++;
      if (a >= MASK_SOLID) solid++;
    } else if (seen[p] === 0) {
      holePixels++;
    }
  }

  report.coverage = kept / n;
  report.solid = solid / n;
  report.soft = (kept - solid) / n;
  report.holes = kept + holePixels > 0 ? holePixels / (kept + holePixels) : 0;

  if (report.coverage < limits.minCoverage) report.reject = "empty";
  else if (report.coverage > limits.maxCoverage) report.reject = "everything";
  else if (report.holes > limits.maxHoles) report.reject = "holes";
  else if (kept === 0 || solid / kept < limits.minSolid) report.reject = "mush";
  return report;
}

/** True when the mask is worth putting on the shirt. */
export function maskIsUsable(report: MaskReport): boolean {
  return report.reject === undefined;
}

/**
 * Cleans up a model mask in place: leftover backdrop haze becomes fully
 * transparent, while genuine soft edges (hair, fur, glass) are kept.
 */
export function polishMask(alpha: Uint8Array | Uint8ClampedArray, haze = MASK_HAZE): boolean {
  let changed = false;
  for (let p = 0; p < alpha.length; p++) {
    if (alpha[p] > 0 && alpha[p] < haze) {
      alpha[p] = 0;
      changed = true;
    }
  }
  return changed;
}
