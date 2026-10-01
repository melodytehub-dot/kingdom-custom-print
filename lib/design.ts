import type {
  Design,
  DesignLayer,
  GarmentSide,
  ImageLayer,
  PrintArea,
  TextLayer,
} from "./types";

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

export function newTextLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: `t-${Math.random().toString(36).slice(2, 10)}`,
    type: "text",
    text: "Your text",
    x: 50,
    y: 50,
    scale: 1,
    rotation: 0,
    font: "anton",
    fontSize: 7,
    color: "#141414",
    weight: 700,
    italic: false,
    uppercase: true,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.05,
    ...overrides,
  };
}

export function newImageLayer(src: string, name: string): ImageLayer {
  return {
    id: `i-${Math.random().toString(36).slice(2, 10)}`,
    type: "image",
    src,
    name,
    x: 50,
    y: 50,
    scale: 0.6,
    rotation: 0,
    opacity: 1,
  };
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

/**
 * Reads a file into a data URL, downscaling oversized raster images so the
 * browser canvas and the stored payload stay small.
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
        const largest = Math.max(img.width, img.height);
        if (largest <= maxEdge) {
          resolve({ width: img.width, height: img.height, dataUrl });
          return;
        }
        const scale = maxEdge / largest;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ width: img.width, height: img.height, dataUrl });
          return;
        }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          width: canvas.width,
          height: canvas.height,
          dataUrl: canvas.toDataURL("image/png"),
        });
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