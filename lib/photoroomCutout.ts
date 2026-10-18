/**
 * The Photoroom comparison engine.
 *
 * Only active in evaluation builds — the customizer asks
 * `photoroomAltReady()` before offering the second "Remove Background" row,
 * and only `NEXT_PUBLIC_CUTOUT_ALT=photoroom` turns it on. Production keeps
 * its single imgix-powered switch.
 *
 * The API key lives on the server (`PHOTOROOM_API_KEY`); the photo is prepared
 * exactly like the imgix path and posted to `/api/photoroom-cutout`, which
 * calls Photoroom and hands back the transparent PNG. The result goes through
 * the same blob → data-URL contract as every other cut-out.
 */
import {
  blobToCutoutDataUrl,
  prepareCutoutUpload,
  type HostedCutoutPhase,
} from "./hostedCutout";

/** Total time the service may take for one photo. */
const RENDER_TIMEOUT_MS = 55_000;

/** True when this build offers the Photoroom comparison button. */
export function photoroomAltReady(): boolean {
  return (process.env.NEXT_PUBLIC_CUTOUT_ALT ?? "").trim() === "photoroom";
}

/** The full trip: photo in, transparent cut-out data URL out. */
export async function photoroomCutoutDataUrl(
  src: string,
  hooks: { onPhase?: (phase: HostedCutoutPhase) => void } = {},
): Promise<string> {
  hooks.onPhase?.("upload");
  const blob = await prepareCutoutUpload(src);
  const form = new FormData();
  form.append("image", blob, blob.type === "image/png" ? "photo.png" : "photo.jpg");
  hooks.onPhase?.("cutting");

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch("/api/photoroom-cutout", {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw new Error("The hosted remover could not be reached.");
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`The hosted remover answered with ${response.status}.`);
  }
  return blobToCutoutDataUrl(await response.blob());
}
