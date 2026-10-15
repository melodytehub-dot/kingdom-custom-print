import type { ImageFx } from "@/lib/types";
import { encodeCanvasUnder } from "@/lib/design";
import { CUTOUT_MAX_EDGE } from "@/lib/cutoutModels";

/**
 * Non-destructive image edits for uploaded artwork. Every function starts from
 * the layer's original pixels, so toggling an option off restores the upload.
 */

export const DEFAULT_FX: ImageFx = {
  filter: "normal",
  inkColor: "#141414",
  removeBg: false,
  crop: false,
  superRes: false,
  recolors: [],
};

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be processed."));
    img.src = src;
  });
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
};

export const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const dist = (a: number[], b: number[]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

/** The most common colour along the image border — the likely background. */
function borderColour(d: Uint8ClampedArray, w: number, h: number): [number, number, number] | null {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 200) return;
    const key = `${d[i] >> 4}-${d[i + 1] >> 4}-${d[i + 2] >> 4}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += d[i];
    e.g += d[i + 1];
    e.b += d[i + 2];
    buckets.set(key, e);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    add(0, y);
    add(w - 1, y);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best) return null;
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

/** Bounding box of visible pixels, ignoring near-empty margins. */
function contentBox(img: ImageData) {
  const { data: d, width: w, height: h } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  const bg = borderColour(d, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 12) continue;
      if (bg && d[i + 3] > 200 && dist([d[i], d[i + 1], d[i + 2]], bg) < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const pad = Math.round(Math.max(w, h) * 0.01);
  return {
    x: Math.max(0, x0 - pad),
    y: Math.max(0, y0 - pad),
    w: Math.min(w, x1 + pad + 1) - Math.max(0, x0 - pad),
    h: Math.min(h, y1 + pad + 1) - Math.max(0, y0 - pad),
  };
}

function sharpen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data;
  const o = out.data;
  const k = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      o[i + 3] = s[i + 3];
      for (let c = 0; c < 3; c++) {
        let v = 0;
        let n = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const xx = Math.min(w - 1, Math.max(0, x + kx));
            const yy = Math.min(h - 1, Math.max(0, y + ky));
            v += s[(yy * w + xx) * 4 + c] * k[n++];
          }
        }
        o[i + c] = Math.min(255, Math.max(0, v));
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

export interface FxResult {
  dataUrl: string;
  aspect: number;
}

/** Applies `fx` to the original image and returns the new pixels. */
export async function applyImageFx(origSrc: string, fx: ImageFx): Promise<FxResult> {
  const img = await load(origSrc);
  const natW = img.naturalWidth || img.width || 1000;
  const natH = img.naturalHeight || img.height || 1000;
  const up = fx.superRes ? Math.min(2, 2400 / Math.max(natW, natH)) : 1;
  const W = Math.max(1, Math.round(natW * Math.max(1, up)));
  const H = Math.max(1, Math.round(natH * Math.max(1, up)));

  let canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  let ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, W, H);
  if (fx.superRes) sharpen(ctx, W, H);

  let data = ctx.getImageData(0, 0, W, H);

  // Recolour swaps from "Edit Colors".
  if (fx.recolors.length) {
    const swaps = fx.recolors.map((r) => ({ from: hexToRgb(r.from), to: hexToRgb(r.to) }));
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      for (const s of swaps) {
        if (dist([d[i], d[i + 1], d[i + 2]], s.from) < 52) {
          d[i] = s.to[0];
          d[i + 1] = s.to[1];
          d[i + 2] = s.to[2];
          break;
        }
      }
    }
  }

  // Single colour: dark areas become ink, light areas become transparent.
  if (fx.filter === "single") {
    const [ir, ig, ib] = hexToRgb(fx.inkColor);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const strength = Math.min(1, Math.max(0, (235 - lum) / 190));
      d[i] = ir;
      d[i + 1] = ig;
      d[i + 2] = ib;
      d[i + 3] = Math.round(d[i + 3] * strength);
    }
  }

  ctx.putImageData(data, 0, 0);

  if (fx.crop) {
    const box = contentBox(data);
    if (box && (box.w < W - 2 || box.h < H - 2)) {
      const cropped = document.createElement("canvas");
      cropped.width = box.w;
      cropped.height = box.h;
      const cctx = cropped.getContext("2d");
      if (cctx) {
        cctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        canvas = cropped;
        ctx = cctx;
      }
    }
  }

  const encoded = encodeCanvasUnder(canvas);
  return { dataUrl: encoded.dataUrl, aspect: encoded.width / encoded.height };
}

export interface CutoutStats {
  /** Fraction of the image that became transparent. */
  ratio: number;
  /** Fraction of the outer border ring that became transparent. */
  borderClear: number;
  /** True when the background looked convincingly like one flat backdrop. */
  uniform: boolean;
}

/**
 * Cuts the backdrop out of an uploaded artwork, using pixels only — no model,
 * no network, no WebGPU — so it runs instantly on every device.
 *
 * The backdrop is every colour reachable from the edge of the picture without
 * crossing a strong edge. Each pixel is compared with its *neighbour* rather
 * than with one global colour, which is what lets gradients, vignettes and
 * photographic shadows fall away while the artwork's own outline stops the
 * fill. Background families are sampled from the four corners so a subject that
 * runs off one edge can never be mistaken for the backdrop.
 */
export function cutoutBackground(img: ImageData): CutoutStats {
  const { data: d, width: w, height: h } = img;
  const n = w * h;
  if (n < 16) return { ratio: 0, borderClear: 0, uniform: false };

  /* ---- 1. Background colour families, sampled from the four corners ------ */
  const patch = Math.max(2, Math.min(20, Math.round(Math.min(w, h) * 0.06)));
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let samples = 0;
  const samplePixel = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 200) return;
    samples++;
    const key = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
    const e = bins.get(key);
    if (e) {
      e.n++;
      e.r += d[i];
      e.g += d[i + 1];
      e.b += d[i + 2];
    } else {
      bins.set(key, { n: 1, r: d[i], g: d[i + 1], b: d[i + 2] });
    }
  };
  for (let py = 0; py < patch; py++) {
    for (let px = 0; px < patch; px++) {
      samplePixel(px, py);
      samplePixel(w - 1 - px, py);
      samplePixel(px, h - 1 - py);
      samplePixel(w - 1 - px, h - 1 - py);
    }
  }
  if (!samples) return { ratio: 0, borderClear: 0, uniform: false };

  const minCount = Math.max(2, samples * 0.03);
  const families = [...bins.values()]
    .filter((e) => e.n >= minCount)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)
    .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n] as const);
  if (!families.length) return { ratio: 0, borderClear: 0, uniform: false };

  // How far a colour may sit from the backdrop families before it is treated as
  // artwork. Wide enough for a vignette or a soft shadow, tight enough that a
  // blurred edge cannot let the walk creep into a saturated subject.
  const globalTol = 135;
  // How big a step between touching pixels still counts as "the same surface".
  // This is the first line of defence at the artwork's outline.
  const localTol = 30;
  // Seeds must match a corner colour closely so a noisy photo border cannot
  // trick the walk into starting.
  const seedTol = 44;
  const backgroundDistance = (i: number) => {
    let best = Infinity;
    for (const f of families) {
      const dr = d[i] - f[0];
      const dg = d[i + 1] - f[1];
      const db = d[i + 2] - f[2];
      const dd = dr * dr + dg * dg + db * db;
      if (dd < best) best = dd;
      if (best === 0) break;
    }
    return Math.sqrt(best);
  };

  /* ---- 2. Flood outwards from the edge ---------------------------------- */
  const visited = new Uint8Array(n);
  const isBackground = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const push = (p: number) => {
    if (visited[p]) return;
    const i = p * 4;
    if (d[i + 3] > 8 && backgroundDistance(i) > seedTol) return;
    visited[p] = 1;
    stack[top++] = p;
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }

  let cleared = 0;
  while (top > 0) {
    const p = stack[--top];
    const i = p * 4;
    if (d[i + 3] > 8 && backgroundDistance(i) > globalTol) continue;
    isBackground[p] = 1;
    cleared++;
    const x = p % w;
    const y = (p - x) / w;
    const visit = (q: number) => {
      if (visited[q]) return;
      const qi = q * 4;
      if (d[qi + 3] <= 8) {
        // Already transparent: keep walking without touching it.
        visited[q] = 1;
        stack[top++] = q;
        return;
      }
      const dr = d[qi] - d[i];
      const dg = d[qi + 1] - d[i + 1];
      const db = d[qi + 2] - d[i + 2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > localTol) return;
      visited[q] = 1;
      stack[top++] = q;
    };
    if (x > 0) visit(p - 1);
    if (x < w - 1) visit(p + 1);
    if (y > 0) visit(p - w);
    if (y < h - 1) visit(p + w);
  }

  let ringTotal = 0;
  let ringClear = 0;
  const checkRing = (p: number) => {
    ringTotal++;
    // Already-transparent artwork (a PNG cut-out) counts as backdrop too.
    if (isBackground[p] || d[p * 4 + 3] <= 8) ringClear++;
  };
  for (let x = 0; x < w; x++) {
    checkRing(x);
    checkRing((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    checkRing(y * w);
    checkRing(y * w + w - 1);
  }
  const borderClear = ringTotal ? ringClear / ringTotal : 0;

  /* ---- 3. Soft matte on the boundary ------------------------------------ */
  // A pixel that touches the backdrop is a blend of backdrop and artwork, so its
  // alpha is the size of its colour step away from the backdrop. This kills the
  // hard, aliased fringe that a binary mask leaves behind.
  const featherInner = 14;
  const featherOuter = 82;
  const alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) alpha[p] = d[p * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (isBackground[p]) {
        alpha[p] = 0;
        continue;
      }
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      if (x > 0 && isBackground[p - 1]) {
        const i = (p - 1) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        count++;
      }
      if (x < w - 1 && isBackground[p + 1]) {
        const i = (p + 1) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        count++;
      }
      if (y > 0 && isBackground[p - w]) {
        const i = (p - w) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        count++;
      }
      if (y < h - 1 && isBackground[p + w]) {
        const i = (p + w) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        count++;
      }
      if (!count) continue;
      const i = p * 4;
      const dd = Math.sqrt(
        (d[i] - r / count) ** 2 + (d[i + 1] - g / count) ** 2 + (d[i + 2] - b / count) ** 2,
      );
      const soft = Math.round((255 * (dd - featherInner)) / (featherOuter - featherInner));
      const clamped = Math.max(0, Math.min(255, soft));
      if (clamped < alpha[p]) alpha[p] = clamped;
    }
  }

  /* ---- 4. Despeckle: drop stray pixels with no opaque neighbours --------- */
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (alpha[p] <= 0) continue;
      let opaque = 0;
      for (let dy = -1; dy <= 1 && opaque === 0; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (alpha[yy * w + xx] > 0) {
            opaque++;
            break;
          }
        }
      }
      if (opaque === 0) alpha[p] = 0;
    }
  }

  for (let p = 0; p < n; p++) d[p * 4 + 3] = alpha[p];

  const uniform =
    borderClear >= 0.985 || (borderClear >= 0.8 && cleared / n >= 0.2);
  return { ratio: cleared / n, borderClear, uniform };
}

export interface QuickCutout {
  dataUrl: string;
  aspect: number;
  /** Fraction of pixels made transparent. */
  ratio: number;
  /** True when enough of the image was background for the result to look right. */
  confident: boolean;
  /** Share of the picture's border that came out as backdrop. */
  borderClear: number;
}

/**
 * Instant, dependency-free background removal. This is the guaranteed path for
 * flat artwork (logos, screenshots, studio product shots) and the safety net
 * when a model cannot be reached; the AI models in `lib/cutoutModels.ts` take
 * over for photos, which no colour-based cutout can key out reliably.
 */
export async function quickBackgroundRemoval(src: string): Promise<QuickCutout | null> {
  const img = await load(src);
  const W = Math.max(1, img.naturalWidth || img.width || 1000);
  const H = Math.max(1, img.naturalHeight || img.height || 1000);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, W, H);

  const full = ctx.getImageData(0, 0, W, H);

  const scale = Math.min(1, CUTOUT_MAX_EDGE / Math.max(W, H));
  const w2 = Math.max(1, Math.round(W * scale));
  const h2 = Math.max(1, Math.round(H * scale));
  let work = full;
  if (w2 !== W || h2 !== H) {
    const small = document.createElement("canvas");
    small.width = w2;
    small.height = h2;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    if (!sctx) return null;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(img, 0, 0, w2, h2);
    work = sctx.getImageData(0, 0, w2, h2);
  }

  const stats = cutoutBackground(work);
  // Nothing matched, the frame came back empty, or the edge of the picture was
  // mostly artwork (a busy photo) — either way there is no trustworthy cutout,
  // so say so instead of pasting a half-removed mess onto the shirt.
  if (stats.ratio <= 0 || stats.ratio >= 0.98 || stats.borderClear < 0.7) return null;

  if (work === full) {
    ctx.putImageData(full, 0, 0);
  } else {
    // Paint the low-resolution mask back over the full-resolution artwork so the
    // printed file keeps every original pixel.
    const mask = document.createElement("canvas");
    mask.width = w2;
    mask.height = h2;
    const mctx = mask.getContext("2d");
    if (!mctx) return null;
    const mimg = mctx.createImageData(w2, h2);
    for (let p = 0; p < w2 * h2; p++) {
      mimg.data[p * 4] = 255;
      mimg.data[p * 4 + 1] = 255;
      mimg.data[p * 4 + 2] = 255;
      mimg.data[p * 4 + 3] = work.data[p * 4 + 3];
    }
    mctx.putImageData(mimg, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    ctx.globalCompositeOperation = "destination-in";
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mask, 0, 0, w2, h2, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  const encoded = encodeCanvasUnder(canvas);
  return {
    dataUrl: encoded.dataUrl,
    aspect: encoded.width / encoded.height,
    ratio: stats.ratio,
    confident:
      stats.uniform && stats.ratio >= 0.03 && stats.ratio <= 0.985,
    borderClear: stats.borderClear,
  };
}

/** True when the artwork should not be sent through the AI model. */
export function isVectorSource(src: string): boolean {
  return src.startsWith("data:image/svg+xml") || src.startsWith("data:image/svg");
}

/**
 * What a picture is made of: how much of it is flat fill, how much is hard
 * edge, and how much detail it carries on average.
 *
 * Used to decide whether "Remove Background" needs a segmentation model at all.
 * It cannot be the instant pass's own confidence: measured in
 * `scripts/qa-cutout-lab.mjs` on the very photo the client sent, the
 * colour-keying flood fill walked the whole low-contrast background, reported
 * itself confident, and cleared **95.7%** of the picture — the exact "it just
 * cropped out all the picture" complaint. What separates flat artwork from a
 * photograph is not detail alone (a photograph of a blurry background is
 * smoother than a wordmark) but *flatness*: artwork is flat fills and a few
 * hard edges, a photograph is gradients and grain everywhere.
 */
export interface ArtworkProfile {
  /** Mean neighbouring-pixel difference, 0-255. */
  texture: number;
  /** Share of neighbouring pixels differing by 2 or less (flat fills). */
  flat: number;
  /** Share differing by 24 or more (hard edges). */
  edges: number;
}

/**
 * Thresholds, calibrated in `scripts/qa-cutout-lab.mjs`
 * (`CUTOUT_LAB_PHASE=instant`). Every row is measured, not guessed:
 *
 *   logo on white         flat 0.986 edges 0.009  → artwork
 *   logo on a gradient    flat 0.986 edges 0.010  → artwork
 *   sticker with shading  flat 0.972 edges 0.019  → artwork
 *   b/w wordmark          flat 0.950 edges 0.038  → artwork
 *   portrait, soft bokeh  flat 0.713 edges 0.033  → photograph
 *   portrait, bare torso  flat 0.655 edges 0.053  → photograph
 *   mug on a table        flat 0.621 edges 0.054  → photograph
 *   client's photo        flat 0.454 edges 0.083  → photograph
 *
 * The closest case is the wordmark, and it is the one that matters: text is
 * edges, so it must never be judged on texture alone. Flatness is what a
 * photographer cannot fake — grain and shallow depth of field put a pixel on
 * every value between the fills.
 */
export const FLAT_ARTWORK_MIN_FLAT = 0.9;
export const FLAT_ARTWORK_MAX_EDGES = 0.06;

/**
 * Profiles a picture from a 256 px copy: 65 k pixels is enough to tell a fill
 * from a photograph and cheap enough to run before every upload.
 */
export async function artworkProfile(src: string): Promise<ArtworkProfile> {
  const img = await load(src);
  const size = 256;
  const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const width = ratio >= 1 ? size : Math.max(16, Math.round(size * ratio));
  const height = ratio >= 1 ? Math.max(16, Math.round(size / ratio)) : size;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { texture: 0, flat: 1, edges: 0 };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const grey = new Float32Array(width * height);
  for (let p = 0; p < grey.length; p++) {
    const i = p * 4;
    grey[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let sum = 0;
  let flat = 0;
  let edges = 0;
  let pairs = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const step = (q: number) => {
        const difference = Math.abs(grey[q] - grey[p]);
        sum += difference;
        pairs++;
        if (difference <= 2) flat++;
        else if (difference >= 24) edges++;
      };
      if (x < width - 1) step(p + 1);
      if (y < height - 1) step(p + width);
    }
  }
  return {
    texture: pairs ? sum / pairs : 0,
    flat: pairs ? flat / pairs : 1,
    edges: pairs ? edges / pairs : 0,
  };
}

/**
 * True when the instant pass is enough and no model should be downloaded.
 * Deliberately strict: calling a photograph "flat artwork" is what produced the
 * complaint, while calling artwork a photograph only costs one 6 MB download.
 */
export function isFlatArtwork(profile: ArtworkProfile): boolean {
  return profile.flat >= FLAT_ARTWORK_MIN_FLAT && profile.edges <= FLAT_ARTWORK_MAX_EDGES;
}

/** Up to `count` dominant colours of an image (ignores transparent pixels). */
export async function dominantColours(src: string, count = 3): Promise<string[]> {
  const img = await load(src);
  const size = 64;
  const c = document.createElement("canvas");
  const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  c.width = ratio >= 1 ? size : Math.max(8, Math.round(size * ratio));
  c.height = ratio >= 1 ? Math.max(8, Math.round(size / ratio)) : size;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = `${d[i] >> 5}-${d[i + 1] >> 5}-${d[i + 2] >> 5}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += d[i];
    e.g += d[i + 1];
    e.b += d[i + 2];
    buckets.set(key, e);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const picked: number[][] = [];
  for (const e of sorted) {
    const rgb = [e.r / e.n, e.g / e.n, e.b / e.n];
    if (picked.every((p) => dist(p, rgb) > 60)) picked.push(rgb);
    if (picked.length >= count) break;
  }
  return picked.map((p) => rgbToHex(p[0], p[1], p[2]));
}
