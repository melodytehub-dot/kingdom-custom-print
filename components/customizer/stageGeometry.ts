/**
 * Fits the garment box inside the stage without ever letting a panel move or
 * resize it.
 *
 * Portrait phones can let the box overflow the stage width so the printable
 * area fills the screen. Wide garments can instead opt into a contained fit.
 * The horizontal centre remains pinned in both cases.
 *
 * `options.visibleH` narrows the strip the box must be centred in (used when a
 * mobile inspector floats over the lower part of the stage) and `options.focusY`
 * keeps the selected element inside that strip. The box size never changes with
 * those options, so opening an editor cannot shrink the artwork.
 */
export interface StageFitOptions {
  /** Height of the unobstructed strip, measured from the top of the stage. */
  visibleH?: number;
  /** View-space (0-900) Y of the element that must stay visible. */
  focusY?: number | null;
  /** Margin in stage pixels kept around a focused element. */
  margin?: number;
  /** Bounds of the visible garment inside its square image, as fractions. */
  contentBounds?: { left: number; right: number; top: number; bottom: number };
}

export const STAGE_VIEW = 900;

export function fitStage(width: number, height: number, zoom = 1, options: StageFitOptions = {}) {
  if (width <= 0 || height <= 0) return { size: 0, left: 0, ty: 0 };
  const portraitPhone = width <= 900 && height > width;
  const bounds = portraitPhone ? options.contentBounds : undefined;
  const fit = bounds
    ? Math.min(Math.max(0, width - 16) / (bounds.right - bounds.left), Math.max(0, height - 24) / (bounds.bottom - bounds.top))
    : portraitPhone
    ? Math.min(width * 1.4, height - 24)
    : Math.min(width - 24, height - 24);
  const size = Math.max(0, fit) * zoom;
  const left = bounds ? width / 2 - size * (bounds.left + bounds.right) / 2 : (width - size) / 2;

  const visibleH = Math.min(height, Math.max(0, options.visibleH ?? height));
  let ty = bounds ? height / 2 - size * (bounds.top + bounds.bottom) / 2 : (height - size) / 2;

  // When an inspector covers the bottom of the stage, centre the artwork in the
  // strip that is still visible and nudge it so the selected element stays in view.
  if (visibleH < height) {
    ty = (visibleH - size) / 2;
    const focusY = options.focusY;
    if (typeof focusY === "number" && Number.isFinite(focusY)) {
      const margin = options.margin ?? 28;
      const focusPx = (focusY / STAGE_VIEW) * size;
      const top = margin;
      const bottom = visibleH - margin;
      if (focusPx + ty < top) ty = top - focusPx;
      if (bottom > top && focusPx + ty > bottom) ty = bottom - focusPx;
    }
  }

  return { size, left, ty };
}
