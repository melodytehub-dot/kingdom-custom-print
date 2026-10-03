import type { Design, DesignLayer, GarmentSide } from "@/lib/types";
import { layerBox, teeArea } from "@/lib/design";
import { displayText, drawArcLine, fontShorthand, measureTextLayer } from "./textGeometry";

/**
 * Renders a flattened preview of each side for the cart and order records.
 * The real tee mockup is used as the base and the print area matches the
 * editor canvas, so what the customer approved matches the cart thumbnail.
 */
const SIZE = 640;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("preview: image failed to load"));
    img.src = src;
  });
}

/** Seeded PRNG so a distressed print looks the same every render. */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DISTRESS_DENSITY = [0, 0.05, 0.12, 0.22];

/** Knocks speckles out of whatever has been drawn into `c` (destination-out). */
function distress(c: CanvasRenderingContext2D, w: number, h: number, level: number, seed: number) {
  const rand = mulberry(seed);
  const count = Math.round(w * h * DISTRESS_DENSITY[Math.min(3, Math.max(0, level))] * 0.02);
  c.save();
  c.globalCompositeOperation = "destination-out";
  for (let i = 0; i < count; i++) {
    const r = 0.6 + rand() * (level >= 3 ? 5 : 3);
    c.globalAlpha = 0.55 + rand() * 0.45;
    c.beginPath();
    c.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawText(ctx: CanvasRenderingContext2D, layer: Extract<DesignLayer, { type: "text" }>, areaH: number) {
  const m = measureTextLayer(layer, areaH);
  const { size, lines, arc } = m;
  ctx.fillStyle = layer.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = layer.align === "left" ? "left" : layer.align === "right" ? "right" : "center";
  ctx.font = fontShorthand(layer, size);

  if (arc) {
    const yShift = (layer.arc > 0 ? -1 : 1) * (arc.sagitta / 2);
    lines.forEach((line, i) => {
      const dy = (i - (lines.length - 1) / 2) * size * layer.lineHeight;
      ctx.save();
      ctx.translate(0, dy);
      drawArcLine(ctx, layer, line, size, arc, yShift);
      ctx.restore();
    });
    return;
  }

  const dx = layer.align === "left" ? -m.w / 2 : layer.align === "right" ? m.w / 2 : 0;
  const spacing = (layer.letterSpacing / 100) * size;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  }

  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * size * layer.lineHeight;
    const text = displayText(layer, line);
    if (layer.strokeWidth > 0) {
      ctx.lineWidth = (layer.strokeWidth / 100) * size;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineJoin = "round";
      ctx.strokeText(text, dx, y);
    }
    ctx.fillText(text, dx, y);
  });

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }
}

async function renderSide(
  side: GarmentSide,
  photo: string,
  layers: DesignLayer[]
): Promise<string | null> {
  if (!layers.length) return null;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";

  try {
    const img = await loadImage(photo);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
  } catch {
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  const frac = teeArea(side);
  const aw = SIZE * frac.w;
  const ah = SIZE * frac.h;
  const ax = SIZE * frac.cx - aw / 2;
  const ay = SIZE * frac.cy - ah / 2;

  for (const [index, layer] of layers.entries()) {
    const cx = ax + (layer.x / 100) * aw;
    const cy = ay + (layer.y / 100) * ah;
    const base = layerBox(layer, { w: aw, h: ah });

    // Each layer is drawn on its own transparent sheet so distressing only
    // erases that layer's ink and never the shirt underneath.
    const sheet = document.createElement("canvas");
    sheet.width = SIZE;
    sheet.height = SIZE;
    const sctx = sheet.getContext("2d");
    if (!sctx) continue;
    sctx.imageSmoothingQuality = "high";

    sctx.save();
    sctx.translate(cx, cy);
    sctx.rotate((layer.rotation * Math.PI) / 180);
    sctx.scale(
      layer.scaleX * (layer.flipH ? -1 : 1),
      layer.scaleY * (layer.flipV ? -1 : 1)
    );

    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src);
        sctx.drawImage(img, -base.w / 2, -base.h / 2, base.w, base.h);
      } catch {
        // Skip artwork that cannot be decoded; the rest of the design still renders.
      }
    } else {
      drawText(sctx, layer, ah);
    }
    sctx.restore();

    if ((layer.distress ?? 0) > 0) {
      distress(sctx, SIZE, SIZE, layer.distress ?? 0, 977 + index * 31);
    }

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(sheet, 0, 0);
    ctx.restore();
  }

  try {
    return canvas.toDataURL("image/webp", 0.85);
  } catch {
    return canvas.toDataURL("image/png");
  }
}

export async function drawPreview(
  frontSrc: string,
  backSrc: string,
  design: Design
): Promise<{ front: string | null; back: string | null }> {
  const [front, back] = await Promise.all([
    renderSide("front", frontSrc, design.front),
    renderSide("back", backSrc, design.back),
  ]);
  return { front, back };
}
