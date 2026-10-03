import type { ImageFx } from "@/lib/types";
import { encodeCanvasUnder } from "@/lib/design";

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

/** Flood-fills the background from the borders so interior colours survive. */
function removeBackground(img: ImageData): boolean {
  const { data: d, width: w, height: h } = img;
  const bg = borderColour(d, w, h);
  if (!bg) return false;
  const tol = 46;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    if (d[i + 3] === 0 || dist([d[i], d[i + 1], d[i + 2]], bg) <= tol) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop() as number;
    d[p * 4 + 3] = 0;
    cleared++;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // Soften the cut-out edge by half-fading pixels that touch the cleared area.
  const edge: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (seen[p]) continue;
      if (seen[p - 1] || seen[p + 1] || seen[p - w] || seen[p + w]) edge.push(p);
    }
  }
  for (const p of edge) d[p * 4 + 3] = Math.min(d[p * 4 + 3], 150);
  return cleared > 0;
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

  if (fx.removeBg) removeBackground(data);

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
