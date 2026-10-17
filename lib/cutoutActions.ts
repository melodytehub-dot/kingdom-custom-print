/**
 * What the customer reads and what they are offered around background removal.
 *
 * Kept apart from `Customizer.tsx` because this is the visible half of the
 * feature: which of the two models ran, whether it worked, and what to do when it
 * did not. Every string here is covered by `scripts/qa-cutout-actions.mjs`.
 */
import { formatModelSize } from "@/lib/cutoutModels";
import type { BackgroundRemovalProgress } from "@/lib/backgroundRemoval";
import type { HostedCutoutPhase } from "@/lib/hostedCutout";
import type { ImageLayer } from "@/lib/types";

/**
 * Background removal runs instantly on-device everywhere; so do the AI models,
 * which is what makes this work on a phone at all. What is device-dependent is
 * the 42 MB detailed model: on a phone it means tens of seconds of CPU, so it
 * is only run automatically on desktop-class browsers and is otherwise offered
 * as a button the customer can choose.
 */
export function canAutoRunDetailedModel(): boolean {
  if (typeof navigator === "undefined") return false;
  return !/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
}

/** What the customer reads while a model downloads or works. */
export function cutoutStatus(progress: BackgroundRemovalProgress): string {
  const name = progress.model?.name ?? "cut-out";
  if (progress.phase === "download") {
    const size = progress.model ? formatModelSize(progress.model.bytes) : "";
    const slow = progress.model?.kind === "general" ? " This one is slower." : "";
    return `Downloading the ${name} model… ${progress.percent ?? 0}% (${size}, downloads once).${slow}`;
  }
  return `Cutting out the subject with the ${name} model…`;
}

/** What the customer reads while the hosted remover has the photo. */
export function hostedCutoutStatus(phase: HostedCutoutPhase): string {
  if (phase === "upload") return "Sending the photo to the hosted AI…";
  if (phase === "waiting") {
    return "The hosted AI is still working on this photo — a new one can take a minute…";
  }
  return "The hosted AI is cutting out the subject…";
}

/**
 * The answer to "did my background go away?". This has to stay honest: when a
 * busy photo could not be cut out, saying so (and pointing at the two ways
 * forward) beats pasting a half-removed picture onto the shirt.
 */
export function cutoutNotice({
  removeBg,
  failure,
  hasCutout,
  hosted = null,
}: {
  removeBg: boolean;
  failure: "no-subject" | "unavailable" | null;
  hasCutout: boolean;
  /** How the hosted remover fared when it was in play. */
  hosted?: "used" | "fell-back" | null;
}): { tone: "ok" | "warn" | "error"; text: string } {
  if (!removeBg) return { tone: "ok", text: "Original background restored." };
  if (failure === "no-subject") {
    return hasCutout
      ? {
          tone: "warn",
          text: "We could not make out a clear subject, so the fast cut-out is applied. Try the detailed model or Select Object.",
        }
      : { tone: "warn", text: "We could not find a subject in that photo. Try Select Object to pick it out by hand." };
  }
  if (failure === "unavailable") {
    return hasCutout
      ? { tone: "warn", text: "Background removed with the fast cut-out — the AI model could not load. Check your connection and try again." }
      : { tone: "warn", text: "The cut-out model could not load. Check your connection and try again." };
  }
  if (!hasCutout) return { tone: "warn", text: "We could not detect a background to remove. Try Select Object for busy photos." };
  if (hosted === "used") return { tone: "ok", text: "Background removed with the hosted AI." };
  if (hosted === "fell-back") {
    return { tone: "warn", text: "Background removed on this device — the hosted AI did not answer." };
  }
  return { tone: "ok", text: "Background removed." };
}

/** The "keep going" button offered in the artwork editor. */
export function cutoutActionFor(
  layer: ImageLayer,
  onRun: (layer: ImageLayer) => void,
): { label: string; hint: string; onRun: () => void } | undefined {
  if (!layer.fx?.removeBg) {
    return {
      label: "Remove Background with AI",
      hint: "Cuts a person or product out of any photo",
      onRun: () => onRun(layer),
    };
  }
  if (layer.cutoutSource === "quick" || layer.cutoutSource === "manual") {
    return {
      label: "Improve Cut-out with AI",
      hint: "Reads the photo and keeps hair and soft edges",
      onRun: () => onRun(layer),
    };
  }
  if (layer.cutoutSource === "portrait") {
    return {
      label: "Try the Detailed Model",
      hint: "Slower, but copes with pets, products and groups",
      onRun: () => onRun(layer),
    };
  }
  // The detailed model has already had its turn: there is nothing better to run.
  if (layer.cutoutSource === "general") return undefined;
  // Neither has the hosted remover — it is the best cut-out on offer.
  if (layer.cutoutSource === "hosted") return undefined;
  // Nothing was cut out at all — the models found no subject, or could not be
  // reached. Leave the customer a way to try again rather than a dead end.
  return {
    label: "Try the AI Cut-out Again",
    hint: "Retries the portrait model, then the detailed one",
    onRun: () => onRun(layer),
  };
}
