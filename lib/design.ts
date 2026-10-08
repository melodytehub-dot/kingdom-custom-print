import type {
  Design,
  DesignLayer,
  GarmentSide,
  ImageLayer,
  PersonalizationKind,
  PrintArea,
  RosterEntry,
  TextLayer,
} from "./types";
import { measureTextLayer } from "@/components/customizer/textGeometry";

/**
 * Layers are stored in normalized coordinates (0-100) relative to the
 * printable area, so a design survives any screen size and can be
 * re-rendered at export resolution without drift.
 */
export const COORD_SCALE = 100;

export function emptyDesign(): Design {
  return { front: [], back: [] };
}

export function cloneDesign(design: Design): Design {
  return {
    front: design.front.map((l) => ({ ...l })),
    back: design.back.map((l) => ({ ...l })),
  };
}

export function countLayers(design: Design): number {
  return design.front.length + design.back.length;
}

/** Sides that contain at least one layer. */
export function usedSides(design: Design): GarmentSide[] {
  const sides: GarmentSide[] = [];
  if (design.front.length) sides.push("front");
  if (design.back.length) sides.push("back");
  return sides;
}

export function areaFor(printArea: PrintArea, side: GarmentSide) {
  return side === "front"
    ? { w: printArea.frontW, h: printArea.frontH }
    : { w: printArea.backW, h: printArea.backH };
}

/**
 * Printable area of the real tee mockup photo, as a fraction of the image.
 * Shared by the editor canvas and the cart preview so they always agree.
 */
export interface TeeArea {
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export const TEE_PRINT_AREA: Record<GarmentSide, TeeArea> = {
  front: { w: 0.44, h: 0.54, cx: 0.5, cy: 0.47 },
  back: { w: 0.48, h: 0.6, cx: 0.5, cy: 0.45 },
};

export function teeArea(side: GarmentSide): TeeArea {
  return TEE_PRINT_AREA[side];
}

/**
 * Unscaled box of a layer in view units. Images are fitted inside the print
 * area using their own aspect ratio (so handles hug the artwork); text is
 * measured with the real font so handles hug the glyphs.
 */
export function layerBox(
  layer: DesignLayer,
  area: { w: number; h: number }
): { w: number; h: number } {
  if (layer.type === "image") {
    const aspect = layer.aspect > 0 ? layer.aspect : 1;
    let w = area.w;
    let h = w / aspect;
    if (h > area.h) {
      h = area.h;
      w = h * aspect;
    }
    return { w, h };
  }
  const m = measureTextLayer(layer, area.h);
  return { w: m.w, h: m.h };
}

/**
 * Clamp a layer so its rendered box stays inside the printable area.
 * `extent` is the layer's half-width/half-height in normalized units, which
 * depends on the measured content, so the caller supplies it.
 */
export function clampToArea(
  layer: DesignLayer,
  extent: { w: number; h: number }
): DesignLayer {
  const halfW = extent.w / 2;
  const halfH = extent.h / 2;
  const x = Math.min(100 - halfW, Math.max(halfW, layer.x));
  const y = Math.min(100 - halfH, Math.max(halfH, layer.y));
  return { ...layer, x: round2(x), y: round2(y) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}`;
}

export function newTextLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: nextId("t"),
    type: "text",
    text: "Your text",
    x: 50,
    y: 50,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    flipH: false,
    flipV: false,
    font: "anton",
    fontSize: 10,
    color: "#141414",
    weight: 700,
    italic: false,
    uppercase: true,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.05,
    strokeColor: "#FFFFFF",
    strokeWidth: 0,
    arc: 0,
    ...overrides,
  };
}

export function newImageLayer(
  src: string,
  name: string,
  aspect = 1,
  overrides: Partial<ImageLayer> = {}
): ImageLayer {
  return {
    id: nextId("i"),
    type: "image",
    src,
    name,
    aspect: aspect > 0 ? aspect : 1,
    x: 50,
    y: 50,
    scaleX: 0.6,
    scaleY: 0.6,
    rotation: 0,
    opacity: 1,
    flipH: false,
    flipV: false,
    ...overrides,
  };
}

/** Fills in fields added after a design was saved, so old drafts still load. */
export function normalizeLayer(layer: DesignLayer): DesignLayer {
  const isImage = layer.type === "image";
  const patched = {
    ...layer,
    scaleX: Number.isFinite(layer.scaleX) ? layer.scaleX : isImage ? 0.6 : 1,
    scaleY: Number.isFinite(layer.scaleY) ? layer.scaleY : isImage ? 0.6 : 1,
    opacity: Number.isFinite(layer.opacity) ? layer.opacity : 1,
    flipH: layer.flipH ?? false,
    flipV: layer.flipV ?? false,
  };
  if (patched.type === "text") {
    return {
      ...patched,
      strokeColor: patched.strokeColor ?? "#FFFFFF",
      strokeWidth: Number.isFinite(patched.strokeWidth) ? patched.strokeWidth : 0,
      arc: Number.isFinite(patched.arc) ? patched.arc : 0,
    };
  }
  return {
    ...patched,
    aspect: Number.isFinite(patched.aspect) && patched.aspect > 0 ? patched.aspect : 1,
  };
}

export function normalizeDesign(design: Design): Design {
  return {
    front: (design.front ?? []).map(normalizeLayer),
    back: (design.back ?? []).map(normalizeLayer),
  };
}

/** Which team personalisation (names / numbers) a design carries. */
export function personalizationOf(design: {
  front?: Array<{ type?: unknown; role?: unknown }>;
  back?: Array<{ type?: unknown; role?: unknown }>;
}): PersonalizationKind {
  const layers = [...(design.front ?? []), ...(design.back ?? [])];
  const names = layers.some((l) => l.type === "text" && l.role === "name");
  const numbers = layers.some((l) => l.type === "text" && l.role === "number");
  return names && numbers ? "both" : names ? "names" : numbers ? "numbers" : "none";
}

/** Clones a layer, offsets it slightly and drops it on top of the original. */
export function duplicateLayer(
  design: Design,
  side: GarmentSide,
  id: string
): { design: Design; id: string } | null {
  const index = design[side].findIndex((l) => l.id === id);
  if (index < 0) return null;
  const src = design[side][index];
  const copy = normalizeLayer({
    ...src,
    id: nextId(src.type === "text" ? "t" : "i"),
    x: Math.min(100, src.x + 5),
    y: Math.min(100, src.y + 5),
  });
  const layers = [...design[side]];
  layers.splice(index + 1, 0, copy);
  return { design: { ...design, [side]: layers }, id: copy.id };
}

/** Reorders a layer within its side. */
export function reorderLayer(
  design: Design,
  side: GarmentSide,
  id: string,
  dir: "front" | "back" | "forward" | "backward"
): Design {
  const layers = [...design[side]];
  const i = layers.findIndex((l) => l.id === id);
  if (i < 0) return design;
  const [layer] = layers.splice(i, 1);
  const target =
    dir === "front"
      ? layers.length
      : dir === "back"
        ? 0
        : dir === "forward"
          ? Math.min(layers.length, i + 1)
          : Math.max(0, i - 1);
  layers.splice(target, 0, layer);
  return { ...design, [side]: layers };
}

export function removeLayer(
  design: Design,
  side: GarmentSide,
  id: string
): Design {
  return { ...design, [side]: design[side].filter((l) => l.id !== id) };
}

export function updateLayer(
  design: Design,
  side: GarmentSide,
  id: string,
  patch: Partial<DesignLayer>
): Design {
  return {
    ...design,
    [side]: design[side].map((l) => (l.id === id ? ({ ...l, ...patch } as DesignLayer) : l)),
  };
}

export function findLayer(
  design: Design,
  side: GarmentSide,
  id: string
): DesignLayer | undefined {
  return design[side].find((l) => l.id === id);
}

/* -------------------------------------------------------------------------
   Upload validation
   ------------------------------------------------------------------------- */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

export interface UploadCheck {
  ok: boolean;
  error?: string;
  warning?: string;
}

export function validateUpload(file: File): UploadCheck {
  const isImage = file.type.startsWith("image/");
  if (!isImage) {
    return { ok: false, error: "That file is not an image. Upload a PNG, JPG, WEBP or SVG." };
  }
  if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
    return {
      ok: false,
      error: `We cannot print ${file.type.split("/")[1]?.toUpperCase() || "that format"}. Use PNG, JPG, WEBP or SVG.`,
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep uploads under 8 MB.`,
    };
  }

  const svg = file.type === "image/svg+xml";
  return {
    ok: true,
    warning: svg
      ? "Vector artwork prints sharpest. Make sure fonts are outlined before uploading."
      : undefined,
  };
}

export interface DecodedImage {
  width: number;
  height: number;
  dataUrl: string;
}

/** Largest data URL the checkout accepts for one image. */
export const MAX_IMAGE_DATA_URL = 380_000;

/**
 * Encodes a canvas as WebP (keeps transparency) and steps quality/size down
 * until it fits under `limit`, so artwork is never silently dropped at checkout.
 */
export function encodeCanvasUnder(
  source: HTMLCanvasElement,
  limit = MAX_IMAGE_DATA_URL
): { dataUrl: string; width: number; height: number } {
  let canvas = source;
  let quality = 0.92;
  for (let attempt = 0; attempt < 12; attempt++) {
    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length <= limit) {
      return { dataUrl, width: canvas.width, height: canvas.height };
    }
    if (quality > 0.55) {
      quality -= 0.12;
    } else {
      const next = document.createElement("canvas");
      next.width = Math.max(64, Math.round(canvas.width * 0.8));
      next.height = Math.max(64, Math.round(canvas.height * 0.8));
      const c = next.getContext("2d");
      if (!c) break;
      c.imageSmoothingQuality = "high";
      c.drawImage(canvas, 0, 0, next.width, next.height);
      canvas = next;
    }
  }
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Reads a file into a data URL, downscaling oversized raster images and
 * recompressing so the stored payload stays small enough to order.
 */
export function readImageFile(
  file: File,
  maxEdge = 1400
): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("We could not read that file. Try again."));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error("That file could not be decoded as an image."));
      img.onload = () => {
        const isSvg = file.type === "image/svg+xml";
        if (isSvg && dataUrl.length <= MAX_IMAGE_DATA_URL) {
          resolve({ width: img.width || 1000, height: img.height || 1000, dataUrl });
          return;
        }
        const largest = Math.max(img.width, img.height) || 1000;
        const scale = Math.min(1, maxEdge / largest);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((img.width || 1000) * scale));
        canvas.height = Math.max(1, Math.round((img.height || 1000) * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ width: img.width, height: img.height, dataUrl });
          return;
        }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(encodeCanvasUnder(canvas));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------------------------
   Persistence — draft designs survive reloads and device changes
   ------------------------------------------------------------------------- */

const DRAFT_KEY = "kcp.drafts.v1";

export interface SavedDraft {
  id: string;
  productSlug: string;
  productName: string;
  colorSlug: string;
  colorName: string;
  colorHex: string;
  design: Design;
  lines?: Record<string, number>;
  roster?: RosterEntry[];
  nn?: {
    names: boolean;
    numbers: boolean;
    subtitles: boolean;
    side: GarmentSide;
    size: "small" | "medium" | "large";
    font: string;
    color: string;
  };
  savedAt: number;
}

export function loadDrafts(): SavedDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedDraft[]) : [];
  } catch {
    return [];
  }
}

export function persistDrafts(drafts: SavedDraft[]): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.slice(0, 12)));
  } catch {
    // Quota exceeded: drop the oldest draft and retry once.
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.slice(0, 2)));
    } catch {
      // Storage unavailable; drafts stay in memory for this session.
    }
  }
}
