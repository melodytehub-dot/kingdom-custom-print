import type { Design, GarmentSide, Product } from "@/lib/types";

/**
 * Renders a flattened preview of each side for the cart and order records.
 *
 * The garment silhouette is drawn with the same proportions as the SVG shown
 * in the editor so what the customer approved matches the cart thumbnail.
 */
const VIEW_W = 320;
const VIEW_H = 340;
const FRAME = { x: 40, y: 42, w: 240, h: 268 };
const SCALE = 2;

interface Pal {
  base: string;
  light: string;
  darker: string;
  edge: string;
}

function mix(hex: string, target: number, amount: number): string {
  const clean = hex.replace("#", "");
  const toInt = (i: number) => parseInt(clean.slice(i, i + 2), 16);
  const [r, g, b] = [toInt(0), toInt(2), toInt(4)];
  const nr = Math.round(r + (target - r) * amount);
  const ng = Math.round(g + (target - g) * amount);
  const nb = Math.round(b + (target - b) * amount);
  return `rgb(${nr},${ng},${nb})`;
}

function palette(hex: string): Pal {
  const clean = hex.replace("#", "");
  const toInt = (i: number) => parseInt(clean.slice(i, i + 2), 16);
  const lum = (0.299 * toInt(0) + 0.587 * toInt(2) + 0.114 * toInt(4)) / 255;
  const target = lum > 0.5 ? 0 : 255;
  return {
    base: hex,
    light: mix(hex, target, 0.16),
    darker: mix(hex, target, 0.2),
    edge: mix(hex, target, 0.34),
  };
}

function fillWithGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  y1: number,
  from: string,
  to: string
) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
}

/** Traces the garment outline for each supported product kind. */
function traceGarment(
  ctx: CanvasRenderingContext2D,
  kind: Product["kind"],
  pal: Pal
) {
  const { x, y, w, h } = FRAME;
  ctx.save();
  ctx.beginPath();

  if (kind === "cap") {
    // Crown
    ctx.moveTo(x + w * 0.18, y + h * 0.73);
    ctx.bezierCurveTo(x + w * 0.18, y + h * 0.22, x + w * 0.36, y + h * 0.14, x + w * 0.5, y + h * 0.14);
    ctx.bezierCurveTo(x + w * 0.64, y + h * 0.14, x + w * 0.82, y + h * 0.22, x + w * 0.82, y + h * 0.73);
    ctx.closePath();
    ctx.fillStyle = pal.base;
    ctx.fill();
    // Brim
    ctx.beginPath();
    ctx.moveTo(x + w * 0.18, y + h * 0.73);
    ctx.bezierCurveTo(x + w * 0.26, y + h * 0.79, x + w * 0.74, y + h * 0.79, x + w * 0.82, y + h * 0.73);
    ctx.bezierCurveTo(x + w * 0.95, y + h * 0.82, x + w * 0.9, y + h * 0.94, x + w * 0.64, y + h * 0.95);
    ctx.bezierCurveTo(x + w * 0.36, y + h * 0.96, x + w * 0.08, y + h * 0.94, x + w * 0.18, y + h * 0.73);
    ctx.closePath();
    ctx.fillStyle = pal.darker;
    ctx.fill();
    ctx.restore();
    return;
  }

  if (kind === "mug") {
    // Handle
    ctx.beginPath();
    ctx.moveTo(x + w * 0.72, y + h * 0.42);
    ctx.bezierCurveTo(x + w * 1.02, y + h * 0.38, x + w * 1.05, y + h * 0.78, x + w * 0.7, y + h * 0.76);
    ctx.lineWidth = 13;
    ctx.strokeStyle = pal.darker;
    ctx.stroke();
    // Body
    roundRect(ctx, x + w * 0.14, y + h * 0.24, w * 0.58, h * 0.66, 8);
    fillWithGradient(ctx, x, y, y + h, pal.darker, pal.darker);
    const grad = ctx.createLinearGradient(x + w * 0.14, 0, x + w * 0.72, 0);
    grad.addColorStop(0, pal.darker);
    grad.addColorStop(0.28, pal.base);
    grad.addColorStop(0.72, pal.base);
    grad.addColorStop(1, pal.darker);
    ctx.fillStyle = grad;
    ctx.fill();
    // Rim
    ctx.beginPath();
    ctx.ellipse(x + w * 0.43, y + h * 0.24, w * 0.29, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.light;
    ctx.fill();
    ctx.restore();
    return;
  }

  // Torso garments
  const isLong = kind === "longsleeve";
  const neck = y + h * 0.05;
  const bodyBottom = y + h * 0.94;
  const bodyLeft = x + w * 0.28;
  const bodyRight = x + w * 0.72;
  const sleeveTip = isLong ? y + h * 0.86 : y + h * 0.62;

  ctx.moveTo(x + w * 0.28, neck);
  ctx.lineTo(x + w * 0.12, neck + 14); // left shoulder
  if (isLong) {
    ctx.lineTo(x + w * 0.06, sleeveTip);
    ctx.lineTo(x + w * 0.2, sleeveTip + 4);
  } else {
    ctx.lineTo(x + w * 0.05, y + h * 0.5);
    ctx.lineTo(x + w * 0.19, y + h * 0.54);
  }
  ctx.lineTo(bodyLeft, y + h * 0.42);
  ctx.lineTo(bodyLeft, bodyBottom);
  ctx.lineTo(bodyRight, bodyBottom);
  ctx.lineTo(bodyRight, y + h * 0.42);
  if (isLong) {
    ctx.lineTo(x + w * 0.8, sleeveTip + 4);
    ctx.lineTo(x + w * 0.94, sleeveTip);
  } else {
    ctx.lineTo(x + w * 0.81, y + h * 0.54);
    ctx.lineTo(x + w * 0.95, y + h * 0.5);
  }
  ctx.lineTo(x + w * 0.88, neck + 14);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, neck, 0, bodyBottom);
  grad.addColorStop(0, pal.light);
  grad.addColorStop(0.45, pal.base);
  grad.addColorStop(1, pal.darker);
  ctx.fillStyle = grad;
  ctx.fill();

  // Neckline
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, neck);
  ctx.quadraticCurveTo(x + w * 0.5, neck + 22, x + w * 0.7, neck);
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.darker;
  ctx.stroke();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("preview: image failed to load"));
    img.src = src;
  });
}

const fontStack = {
  anton: 'Anton, "Arial Narrow", Impact, sans-serif',
  inter: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

async function renderSide(
  ctx: CanvasRenderingContext2D,
  product: Product,
  colorHex: string,
  side: GarmentSide,
  layers: Design["front"]
): Promise<string> {
  const pal = palette(colorHex);

  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  // Subtle ground shadow
  ctx.beginPath();
  ctx.ellipse(VIEW_W / 2, FRAME.y + FRAME.h * 0.96, FRAME.w * 0.36, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,20,20,0.07)";
  ctx.fill();

  traceGarment(ctx, product.kind, pal);

  const area = product.printArea;
  const frac = side === "front" ? { w: area.frontW, h: area.frontH } : { w: area.backW, h: area.backH };
  const ax = FRAME.x + (FRAME.w * (1 - frac.w)) / 2;
  const ay = FRAME.y + (FRAME.h * (1 - frac.h)) / 2;
  const aw = FRAME.w * frac.w;
  const ah = FRAME.h * frac.h;

  if (!layers.length) {
    return canvasToDataUrl(ctx);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(ax, ay, aw, ah);
  ctx.clip();

  for (const layer of layers) {
    const cx = ax + (layer.x / 100) * aw;
    const cy = ay + (layer.y / 100) * ah;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);

    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src);
        const boxW = (aw * layer.scale) / 100;
        const boxH = (ah * layer.scale * 0.86) / 100;
        const ratio = img.width / img.height || 1;
        let dw = boxW;
        let dh = boxW / ratio;
        if (dh > boxH) {
          dh = boxH;
          dw = boxH * ratio;
        }
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      } catch {
        // Skip artwork that cannot be decoded; the rest of the design still renders.
      }
    } else {
      const size = (layer.fontSize / 100) * ah;
      const family = fontStack[layer.font as keyof typeof fontStack] ?? fontStack.inter;
      ctx.fillStyle = layer.color;
      ctx.textAlign =
        layer.align === "left" ? "left" : layer.align === "right" ? "right" : "center";
      ctx.textBaseline = "middle";
      ctx.font = `${layer.italic ? "italic " : ""}${layer.weight} ${size}px ${family}`;

      const lines = layer.text.split("\n");
      const dx = layer.align === "left" ? -aw * 0.42 : layer.align === "right" ? aw * 0.42 : 0;
      lines.forEach((line, i) => {
        const y = (i - (lines.length - 1) / 2) * size * layer.lineHeight;
        ctx.fillText(layer.uppercase ? line.toUpperCase() : line, dx, y);
      });
    }
    ctx.restore();
  }

  ctx.restore();
  return canvasToDataUrl(ctx);
}

function canvasToDataUrl(ctx: CanvasRenderingContext2D): string {
  try {
    return ctx.canvas.toDataURL("image/webp", 0.82);
  } catch {
    return ctx.canvas.toDataURL("image/png");
  }
}

function newCanvas(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW_W * SCALE;
  canvas.height = VIEW_H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

export async function drawPreview(
  product: Product,
  colorHex: string,
  design: Design
): Promise<{ front: string | null; back: string | null }> {
  const front = design.front.length
    ? await renderSide(newCanvas(), product, colorHex, "front", design.front)
    : null;
  const back = design.back.length
    ? await renderSide(newCanvas(), product, colorHex, "back", design.back)
    : null;
  return { front, back };
}