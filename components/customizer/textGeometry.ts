import type { TextLayer } from "@/lib/types";
import { canvasFontStack } from "@/lib/fonts";

/**
 * Text measuring and arc geometry shared by the editor canvas (SVG), the
 * selection handles and the flattened cart preview (2D canvas). Keeping the
 * maths in one place is what makes the handles hug the text and the cart
 * thumbnail match what the shopper designed.
 */

let measureCtx: CanvasRenderingContext2D | null | undefined;

function ctx(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === "undefined") return null;
  measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

export function fontShorthand(layer: TextLayer, sizePx: number): string {
  return `${layer.italic ? "italic " : ""}${layer.weight} ${sizePx}px ${canvasFontStack(layer.font)}`;
}

export function displayText(layer: TextLayer, line: string): string {
  return layer.uppercase ? line.toUpperCase() : line;
}

/** Rendered width of one line, including letter spacing. */
export function lineWidth(layer: TextLayer, line: string, sizePx: number): number {
  const text = displayText(layer, line);
  const spacing = (layer.letterSpacing / 100) * sizePx;
  const c = ctx();
  if (!c) return text.length * (sizePx * 0.6 + spacing);
  c.font = fontShorthand(layer, sizePx);
  return c.measureText(text).width + spacing * text.length;
}

export interface ArcShape {
  /** Radius of the circle the baseline follows. */
  radius: number;
  /** Total sweep in radians. */
  theta: number;
  /** Depth of the curve (distance from apex to the chord). */
  sagitta: number;
  /** Straight-line distance between the two ends of the text. */
  chord: number;
}

export function arcShape(length: number, arc: number): ArcShape | null {
  if (!arc || length <= 0) return null;
  const theta = (Math.abs(arc) / 100) * Math.PI;
  const radius = length / theta;
  return {
    radius,
    theta,
    sagitta: radius * (1 - Math.cos(theta / 2)),
    chord: 2 * radius * Math.sin(theta / 2),
  };
}

export interface TextMetrics {
  size: number;
  lines: string[];
  widths: number[];
  /** Widest line (arc-adjusted chord when curved). */
  w: number;
  h: number;
  arc: ArcShape | null;
}

export function measureTextLayer(layer: TextLayer, areaH: number): TextMetrics {
  const size = (layer.fontSize / 100) * areaH;
  const lines = layer.text.split("\n");
  const widths = lines.map((l) => lineWidth(layer, l, size));
  const longest = Math.max(...widths, size * 0.8);
  const arc = arcShape(longest, layer.arc ?? 0);
  const stackH = Math.max(size, lines.length * size * layer.lineHeight);
  const h = stackH + (arc ? arc.sagitta : 0);
  const w = arc ? Math.max(arc.chord, size) : longest;
  return { size, lines, widths, w: w + size * 0.2, h, arc };
}

/** SVG path for the baseline of an arc, apex placed at (0, 0). */
export function arcPath(shape: ArcShape, arc: number): string {
  const { radius: R, theta } = shape;
  const half = theta / 2;
  const dx = R * Math.sin(half);
  if (arc > 0) {
    const y = R - R * Math.cos(half);
    return `M ${-dx} ${y} A ${R} ${R} 0 0 1 ${dx} ${y}`;
  }
  const y = -R + R * Math.cos(half);
  return `M ${-dx} ${y} A ${R} ${R} 0 0 0 ${dx} ${y}`;
}

/** Draws curved text into a 2D context, centred on the current origin. */
export function drawArcLine(
  c: CanvasRenderingContext2D,
  layer: TextLayer,
  line: string,
  size: number,
  shape: ArcShape,
  yShift: number
) {
  const text = displayText(layer, line);
  const spacing = (layer.letterSpacing / 100) * size;
  const positive = layer.arc > 0;
  const R = shape.radius;
  const baseApexY = yShift + size * 0.35;
  const centerY = positive ? baseApexY + R : baseApexY - R;

  c.font = fontShorthand(layer, size);
  c.textAlign = "center";
  c.textBaseline = "alphabetic";

  const advances = Array.from(text).map((ch) => c.measureText(ch).width + spacing);
  const total = advances.reduce((a, b) => a + b, 0);
  let run = -total / 2;

  Array.from(text).forEach((ch, i) => {
    const mid = run + advances[i] / 2;
    run += advances[i];
    const a = mid / R;
    c.save();
    if (positive) {
      c.translate(R * Math.sin(a), centerY - R * Math.cos(a));
      c.rotate(a);
    } else {
      c.translate(R * Math.sin(a), centerY + R * Math.cos(a));
      c.rotate(-a);
    }
    if (layer.strokeWidth > 0) {
      c.lineWidth = (layer.strokeWidth / 100) * size;
      c.strokeStyle = layer.strokeColor;
      c.lineJoin = "round";
      c.strokeText(ch, 0, 0);
    }
    c.fillText(ch, 0, 0);
    c.restore();
  });
}
