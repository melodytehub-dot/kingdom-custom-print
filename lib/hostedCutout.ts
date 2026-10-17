/**
 * The hosted background remover, wired for the editor.
 *
 * When `NEXT_PUBLIC_IMGIX_SOURCE` names the account's imgix source, photos are
 * cut out by imgix rather than the on-device models: the photo is parked on our
 * own site for up to a day (`/api/cutout-bridge`) so imgix can fetch it, and the
 * transparent PNG comes back through the same `encodeCanvasUnder` contract the
 * on-device result obeys (WebP, transparency kept, under 380 KB).
 *
 * Everything here is best-effort by design: any failure — no signal, no
 * credits, a photo imgix cannot cut — throws, and the caller falls back to the
 * on-device models so "Remove Background" never dead-ends.
 *
 * imgix reports a removal that is still being processed as HTTP 423
 * ("Locked"); the request is simply retried until the render is ready. A
 * removal that genuinely failed answers with an error because the request asks
 * for `bg-remove-fallback=false` (see `lib/imgixCutout.ts`).
 */
import { encodeCanvasUnder } from "./design";
import { imgixCutoutUrl } from "./imgixCutout";

/** The bridge refuses photos over 4 MB; aim comfortably under. */
const BRIDGE_ACCEPT_BYTES = 3_900_000;
/** Total time the hosted render may take, first cold render included. */
const RENDER_DEADLINE_MS = 120_000;
/** Gap between "still processing" retries. */
const RETRY_MS = 4_000;
/** A single request that never answers is treated as unreachable. Cold
 * renders answer in seconds (measured ~6 s); a 423 restarts the clock. */
const ATTEMPT_TIMEOUT_MS = 45_000;

export type HostedCutoutPhase =
  /** Shrinking and sending the photo. */
  | "upload"
  /** Sent; waiting for the hosted render. */
  | "cutting"
  /** imgix answered "still processing"; trying again shortly. */
  | "waiting";

/** The configured imgix source host, or "" when hosted removal is off. */
export function hostedCutoutDomain(): string {
  return (process.env.NEXT_PUBLIC_IMGIX_SOURCE ?? "").trim();
}

/** True when a hosted remover is configured for this build. */
export function hostedCutoutReady(): boolean {
  return hostedCutoutDomain() !== "";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That photo could not be read as an image."));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("This browser could not prepare the photo.")),
      type,
      quality,
    );
  });
}

/** The photo as bytes: a data URL, a same-origin path or an object URL. */
async function sourceToBlob(src: string): Promise<Blob> {
  const response = await fetch(src).catch(() => null);
  if (!response?.ok) throw new Error("That photo could not be read.");
  return await response.blob();
}

/**
 * The bytes to send to imgix. imgix's background removal accepts **jpg/png
 * only** — it refuses anything else with `400 Invalid file type, expected
 * jpg/png`. The editor stores uploads as WebP, so the usual photo is
 * re-encoded to JPEG here; an oversized jpg/png (a big art file) is scaled to
 * 2048 px and re-compressed.
 */
export async function prepareCutoutUpload(src: string): Promise<Blob> {
  const blob = await sourceToBlob(src);
  const acceptable = blob.type === "image/jpeg" || blob.type === "image/png";
  if (acceptable && blob.size <= BRIDGE_ACCEPT_BYTES) return blob;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImage(objectUrl);
    const maxEdge = 2048;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (blob.type === "image/png") {
      const png = await toBlob(canvas, "image/png");
      if (png.size <= 3_400_000) return png;
    }
    let quality = 0.92;
    let jpeg = await toBlob(canvas, "image/jpeg", quality);
    while (jpeg.size > 3_400_000 && quality > 0.55) {
      quality -= 0.1;
      jpeg = await toBlob(canvas, "image/jpeg", quality);
    }
    return jpeg;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Parks the photo on our own site and returns the path imgix should fetch. */
export async function uploadCutoutPhoto(blob: Blob): Promise<string> {
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const form = new FormData();
  form.append("image", blob, `photo.${extension}`);
  const response = await fetch("/api/cutout-bridge", { method: "POST", body: form });
  const payload = (await response.json().catch(() => null)) as { path?: string } | null;
  if (!response.ok || !payload?.path) {
    throw new Error("The hosted remover could not receive the photo.");
  }
  return payload.path;
}

/**
 * Asks imgix for the cut-out and returns the editor's data-URL contract.
 * Retries while imgix reports the render is still processing (423).
 */
export async function renderHostedCutout(
  domain: string,
  path: string,
  hooks: { onWaiting?: () => void } = {},
): Promise<string> {
  const url = imgixCutoutUrl(domain, path);
  const deadline = Date.now() + RENDER_DEADLINE_MS;

  for (;;) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      throw new Error("The hosted remover could not be reached.");
    } finally {
      window.clearTimeout(timer);
    }

    if (response.status === 423) {
      // imgix is still cutting this photo out; the same URL will be ready soon.
      if (Date.now() > deadline) throw new Error("The hosted remover is still busy with this photo.");
      hooks.onWaiting?.();
      await new Promise((resolve) => window.setTimeout(resolve, RETRY_MS));
      continue;
    }
    if (!response.ok) {
      // imgix exposes why a removal failed (it is an exposed CORS header);
      // carry it into the error so devtools tells the story of a fallback.
      const reason = response.headers.get("x-imgix-bg-remove-failure-reason");
      throw new Error(
        `The hosted remover answered with ${response.status}${reason ? ` (${reason})` : ""}.`,
      );
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await loadImage(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the photo.");
      context.drawImage(image, 0, 0);
      return encodeCanvasUnder(canvas).dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/** The full hosted trip: photo in, transparent cut-out data URL out. */
export async function hostedCutoutDataUrl(
  src: string,
  hooks: { onPhase?: (phase: HostedCutoutPhase) => void } = {},
): Promise<string> {
  const domain = hostedCutoutDomain();
  if (!domain) throw new Error("Hosted removal is not configured.");
  hooks.onPhase?.("upload");
  const blob = await prepareCutoutUpload(src);
  const path = await uploadCutoutPhoto(blob);
  hooks.onPhase?.("cutting");
  return renderHostedCutout(domain, path, { onWaiting: () => hooks.onPhase?.("waiting") });
}
