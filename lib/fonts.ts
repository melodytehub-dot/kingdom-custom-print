export interface FontOption {
  value: string;
  label: string;
  /** CSS custom property set by next/font (empty for plain system stacks). */
  cssVar: string;
  fallback: string;
  /** Scripts the face can render; web-safe stacks cover Greek and Hebrew. */
  scripts?: ("latin" | "greek" | "hebrew")[];
}

export const FONTS: FontOption[] = [
  { value: "anton", label: "Anton", cssVar: "--font-anton", fallback: "'Arial Narrow', Impact, sans-serif" },
  { value: "bebas", label: "Bebas Neue", cssVar: "--font-bebas", fallback: "Impact, 'Arial Narrow', sans-serif" },
  { value: "archivo", label: "Archivo Black", cssVar: "--font-archivo", fallback: "'Arial Black', sans-serif" },
  { value: "outfit", label: "Outfit", cssVar: "--font-outfit", fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { value: "oswald", label: "Oswald", cssVar: "--font-oswald", fallback: "'Arial Narrow', sans-serif" },
  { value: "inter", label: "Inter", cssVar: "--font-inter", fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { value: "playfair", label: "Playfair Display", cssVar: "--font-playfair", fallback: "Georgia, 'Times New Roman', serif" },
  { value: "pacifico", label: "Pacifico", cssVar: "--font-pacifico", fallback: "cursive" },
  { value: "lobster", label: "Lobster", cssVar: "--font-lobster", fallback: "cursive" },
  { value: "montserrat", label: "Montserrat", cssVar: "--font-montserrat", fallback: "Arial, sans-serif" },
  { value: "raleway", label: "Raleway", cssVar: "--font-raleway", fallback: "Arial, sans-serif" },
  { value: "roboto-condensed", label: "Roboto Condensed", cssVar: "--font-roboto-condensed", fallback: "'Arial Narrow', sans-serif" },
  { value: "merriweather", label: "Merriweather", cssVar: "--font-merriweather", fallback: "Georgia, serif" },
  { value: "permanent-marker", label: "Permanent Marker", cssVar: "--font-permanent-marker", fallback: "cursive" },
  { value: "serif", label: "Georgia", cssVar: "", fallback: "Georgia, 'Times New Roman', serif", scripts: ["latin", "greek"] },
  { value: "arial", label: "Arial Bold", cssVar: "", fallback: "Arial, 'Helvetica Neue', Helvetica, sans-serif", scripts: ["latin", "greek", "hebrew"] },
  { value: "times", label: "Times New Roman", cssVar: "", fallback: "'Times New Roman', Times, serif", scripts: ["latin", "greek", "hebrew"] },
  { value: "courier", label: "Courier New", cssVar: "", fallback: "'Courier New', Courier, monospace", scripts: ["latin", "greek", "hebrew"] },
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

export type FontScript = "latin" | "greek" | "hebrew";

/** Fonts that can render the given script (Latin is the default for brand faces). */
export function fontsForScript(script: FontScript): FontOption[] {
  return FONTS.filter((f) => (f.scripts ?? ["latin"]).includes(script));
}
