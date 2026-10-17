/**
 * What the customer reads around background removal.
 *
 * Kept apart from `Customizer.tsx` because this is the visible half of the
 * feature: what is happening while it works and whether it worked. Copy stays
 * outcome-focused and customer-facing — no implementation or provider talk
 * (client-ready-ux) — and every string here is covered by
 * `scripts/qa-cutout-actions.mjs`.
 */
import type { BackgroundRemovalProgress } from "@/lib/backgroundRemoval";
import type { HostedCutoutPhase } from "@/lib/hostedCutout";

/**
 * Background removal runs instantly on-device everywhere; so do the AI models,
 * which is what makes this work on a phone at all. What is device-dependent is
 * the 42 MB detailed model: on a phone it means tens of seconds of CPU, so it
 * is only run automatically on desktop-class browsers.
 */
export function canAutoRunDetailedModel(): boolean {
  if (typeof navigator === "undefined") return false;
  return !/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
}

/** What the customer reads while the cut-out prepares or works. */
export function cutoutStatus(progress: BackgroundRemovalProgress): string {
  if (progress.phase === "download") {
    const slow = progress.model?.kind === "general" ? " This one takes longer." : "";
    return `Preparing background removal… ${progress.percent ?? 0}% (downloads once).${slow}`;
  }
  return "Removing background…";
}

/** What the customer reads while the photo is processed off-device. */
export function hostedCutoutStatus(phase: HostedCutoutPhase): string {
  if (phase === "upload") return "Preparing your photo…";
  if (phase === "waiting") {
    return "Still removing the background — a large photo can take up to a minute…";
  }
  return "Removing background…";
}

/**
 * The answer to "did my background go away?". This has to stay honest: when a
 * busy photo could not be cut out, saying so (rather than pasting a
 * half-removed picture onto the shirt) is always the better outcome.
 */
export function cutoutNotice({
  removeBg,
  failure,
  hasCutout,
}: {
  removeBg: boolean;
  failure: "no-subject" | "unavailable" | null;
  hasCutout: boolean;
}): { tone: "ok" | "warn" | "error"; text: string } {
  if (!removeBg) return { tone: "ok", text: "Original background restored." };
  if (failure === "no-subject") {
    return hasCutout
      ? {
          tone: "warn",
          text: "The background was removed, but we could not make out a clear subject — zoom in and check the edges.",
        }
      : {
          tone: "warn",
          text: "We could not find a subject in that photo. Try a photo with a plainer background.",
        };
  }
  if (failure === "unavailable") {
    return hasCutout
      ? {
          tone: "warn",
          text: "The background was removed with a simpler cut-out — check your connection if the edges need work.",
        }
      : { tone: "warn", text: "Background removal could not load. Check your connection and try again." };
  }
  if (!hasCutout) {
    return {
      tone: "warn",
      text: "We could not detect a background to remove. Try a photo with a plainer background.",
    };
  }
  return { tone: "ok", text: "Background removed." };
}
