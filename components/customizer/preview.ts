import type { Design, DesignLayer, GarmentSide } from "@/lib/types";
import { layerBox, teeArea } from "@/lib/design";
import { canvasFontStack } from "@/lib/fonts";

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

function fitContain(iw: number, ih: number, bw: number, bh: number) {
  const ratio = iw / ih || 1;
  let dw = bw;
  let dh = bw / ratio;
  if (dh > bh) {
    dh = bh;
    dw = bh * ratio;
  }
  return { dw, dh };
}

function drawText(ctx: CanvasRenderingContext2D, layer: Extract<DesignLayer, { type: "text" }>, areaH: number) {
  const size = (layer.fontSize / 100) * areaH;
  const family = canvasFontStack(layer.font);
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.align === "left" ? "left" : layer.align === "right" ? "right" : "center";
  ctx.textBaseline = "middle";
  ctx.font = `${layer.italic ? "italic " : ""}${layer.weight} ${size}px ${family}`;

  const lines = layer.text.split("\n");
  const dx = layer.align === "left" ? -areaH * 0.9 : layer.align === "right" ? areaH * 0.9 : 0;

  // Canvas letter spacing is supported in modern browsers; ignore where it is not.
  const spacing = (layer.letterSpacing / 100) * size;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  }

  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * size * layer.lineHeight;
    const text = layer.uppercase ? line.toUpperCase() : line;
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

  ctx.save();
  ctx.beginPath();
  ctx.rect(ax, ay, aw, ah);
  ctx.clip();

  for (const layer of layers) {
    const cx = ax + (layer.x / 100) * aw;
    const cy = ay + (layer.y / 100) * ah;
    const base = layerBox(layer, { w: aw, h: ah });

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(
      layer.scaleX * (layer.flipH ? -1 : 1),
      layer.scaleY * (layer.flipV ? -1 : 1)
    );

    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src);
        const { dw, dh } = fitContain(img.width, img.height, base.w, base.h);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      } catch {
        // Skip artwork that cannot be decoded; the rest of the design still renders.
      }
    } else {
      drawText(ctx, layer, ah);
    }
    ctx.restore();
  }

  ctx.restore();

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
