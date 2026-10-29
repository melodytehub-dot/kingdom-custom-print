export interface FontOption {
  value: string;
  label: string;
  /** CSS custom property set by next/font (empty for plain system stacks). */
  cssVar: string;
  fallback: string;
  /** Google Fonts family loaded only when a customer selects it. */
  googleFamily?: string;
  googleWeight?: number;
  /** Scripts the face can render; web-safe stacks cover Greek and Hebrew. */
  scripts?: ("latin" | "greek" | "hebrew")[];
}

const BUILT_IN_FONTS: FontOption[] = [
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

// Lumise's font picker advertises 800+ Google Fonts. Keep a useful print-focused
// catalog here and fetch each font only when it is selected, so the editor does
// not download dozens of unused font files when it opens.
const GOOGLE_FONT_FAMILIES = [
  "ABeeZee", "Abril Fatface", "Alegreya", "Alfa Slab One", "Amatic SC",
  "Architects Daughter", "Arvo", "Barlow", "Barlow Condensed", "Bitter",
  "Bodoni Moda", "Cabin", "Caveat", "Cinzel", "Comfortaa",
  "Cormorant Garamond", "Crimson Text", "DM Sans", "DM Serif Display",
  "Dancing Script", "Fira Sans", "Fjalla One", "Fredoka", "Great Vibes",
  "IBM Plex Mono", "Inconsolata", "Josefin Sans", "Kanit", "Lato",
  "League Spartan", "Libre Baskerville", "Lora", "Manrope", "Merriweather Sans",
  "Mulish", "Nunito", "Open Sans", "Orbitron", "PT Sans", "Poppins",
  "Quicksand", "Righteous", "Roboto", "Roboto Slab", "Rubik", "Satisfy",
  "Space Grotesk", "Space Mono", "Special Elite", "Teko", "Ubuntu",
  "Unbounded", "Work Sans", "Yeseva One", "Zilla Slab",
  // Font families used by text layers in the imported Lumise templates.
  "Aladin", "Arizonia", "Audiowide", "Baumans", "Berkshire Swash",
  "Black Ops One", "Bungee Inline", "Bungee Shade", "Caveat Brush",
  "Coda Caption", "Cookie", "Crete Round", "Damion", "Delius Swash Caps",
  "Ewert", "Faster One", "Flamenco", "Fredericka the Great", "Frijole",
  "Handlee", "Holtwood One SC", "Josefin Slab", "Keania One",
  "Londrina Shadow", "Monoton", "Niconne", "Nosifer", "Oxygen",
  "Patua One", "Racing Sans One", "Rubik Mono One", "Slabo 27px",
  "Suez One", "Tangerine", "Titillium Web", "Vast Shadow", "Vinhan",
  "Yellowtail", "Yesteryear", "Zilla Slab Highlight",
] as const;

const googleFonts: FontOption[] = GOOGLE_FONT_FAMILIES.map((family) => {
  const value = family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // The old template names Vinhan, which is unavailable from Google Fonts.
  // Vina Sans is an available approximation until the original font is supplied.
  const resolvedFamily = family === "Vinhan" ? "Vina Sans" : family;
  return {
    value: `google-${value}`,
    label: family,
    cssVar: "",
    fallback: `"${resolvedFamily}", sans-serif`,
    googleFamily: resolvedFamily,
    ...(family === "Coda Caption" ? { googleWeight: 800 } : {}),
  };
});

export const FONTS: FontOption[] = [...BUILT_IN_FONTS, ...googleFonts];

const BY_VALUE = new Map(FONTS.map((f) => [f.value, f]));
const GOOGLE_FONT_LOADS = new Map<string, Promise<void>>();

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

/** Load a selected Lumise-style Google Font in the browser before applying it. */
export function ensureFontLoaded(value: string): Promise<void> {
  const font = option(value);
  const googleFamily = font.googleFamily;
  if (!googleFamily || typeof document === "undefined") return Promise.resolve();

  const cached = GOOGLE_FONT_LOADS.get(font.value);
  if (cached) return cached;

  const load = new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    const familyQuery = `${encodeURIComponent(googleFamily)}${font.googleWeight ? `:wght@${font.googleWeight}` : ""}`;
    link.href = `https://fonts.googleapis.com/css2?family=${familyQuery}&display=swap`;
    link.onload = () => {
      void document.fonts.load(`${font.googleWeight ?? 400} 16px "${googleFamily}"`).then(() => resolve(), reject);
    };
    link.onerror = () => reject(new Error(`Could not load ${font.label}`));
    document.head.append(link);
  });

  GOOGLE_FONT_LOADS.set(font.value, load);
  void load.catch(() => GOOGLE_FONT_LOADS.delete(font.value));
  return load;
}
