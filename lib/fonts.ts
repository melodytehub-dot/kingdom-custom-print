export interface FontOption {
  value: string;
  label: string;
  /** CSS custom property set by next/font (empty for plain system stacks). */
  cssVar: string;
  fallback: string;
}

export const FONTS: FontOption[] = [
  { value: "anton", label: "Anton", cssVar: "--font-anton", fallback: "'Arial Narrow', Impact, sans-serif" },
  { value: "bebas", label: "Bebas Neue", cssVar: "--font-bebas", fallback: "Impact, 'Arial Narrow', sans-serif" },
  { value: "archivo", label: "Archivo Black", cssVar: "--font-archivo", fallback: "'Arial Black', sans-serif" },
  { value: "oswald", label: "Oswald", cssVar: "--font-oswald", fallback: "'Arial Narrow', sans-serif" },
  { value: "inter", label: "Inter", cssVar: "--font-inter", fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { value: "playfair", label: "Playfair Display", cssVar: "--font-playfair", fallback: "Georgia, 'Times New Roman', serif" },
  { value: "pacifico", label: "Pacifico", cssVar: "--font-pacifico", fallback: "cursive" },
  { value: "lobster", label: "Lobster", cssVar: "--font-lobster", fallback: "cursive" },
  { value: "serif", label: "Georgia", cssVar: "", fallback: "Georgia, 'Times New Roman', serif" },
];

const BY_VALUE = new Map(FONTS.map((f) => [f.value, f]));

function option(value: string): FontOption {
  return BY_VALUE.get(value) ?? FONTS[0];
}

/** Font stack for SVG `font-family` — CSS variables resolve in the browser. */
export function svgFontStack(value: string): string {
  const f = option(value);
  return f.cssVar ? `var(${f.cssVar}), ${f.fallback}` : f.fallback;
}

/** Font stack for the 2D canvas, which cannot read CSS variables itself. */
export function canvasFontStack(value: string): string {
  const f = option(value);
  if (f.cssVar && typeof window !== "undefined") {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(f.cssVar)
      .trim();
    if (resolved) return `${resolved}, ${f.fallback}`;
  }
  return f.fallback;
}
