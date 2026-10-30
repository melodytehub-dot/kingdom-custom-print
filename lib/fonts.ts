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

// Curated open-source fonts perfect for t-shirt printing (SIL OFL License).
// Optimized for readability, print quality, and design versatility.
// Each font loads on-demand to keep the editor fast.
const GOOGLE_FONT_FAMILIES = [
  // === BOLD DISPLAY & STREETWEAR ===
  "Bebas Neue",         // Classic streetwear, tight condensed
  "Anton",              // Heavy impact font for bold statements
  "Oswald",             // Semi-condensed, athletic feel
  "Archivo Black",      // Ultra-bold sans for headlines
  "Rubik",              // Rounded geometric with 9 weights
  "Righteous",          // Retro-inspired display
  "Bungee",             // Playful and chunky
  "Fredoka",            // Soft rounded display
  "Black Ops One",      // Military stencil style
  "Alfa Slab One",      // Fat slab serif display
  "Changa",             // Arabic-inspired geometric
  "Exo 2",              // Futuristic tech aesthetic
  
  // === CONDENSED & NARROW ===
  "Barlow Condensed",   // Clean condensed sans
  "Fjalla One",         // Medium condensed display
  "Teko",               // Ultra-condensed geometric
  "Pathway Gothic One", // Narrow sans-serif
  "Yanone Kaffeesatz",  // Thin condensed display
  
  // === VINTAGE & RETRO ===
  "Abril Fatface",      // High-contrast display serif
  "Bodoni Moda",        // Classic fashion serif
  "Playfair Display",   // Elegant transitional serif
  "Yeseva One",         // Old-school poster serif
  "Ultra",              // Bold vintage serif
  "Rye",                // Western slab serif
  "Ranchers",           // Western slab display
  
  // === SCRIPTS & HANDWRITTEN ===
  "Pacifico",           // Casual brush script
  "Lobster",            // Retro script
  "Dancing Script",     // Elegant cursive
  "Great Vibes",        // Formal calligraphy
  "Satisfy",            // Casual handwriting
  "Caveat",             // Natural handwriting
  "Amatic SC",          // Hand-drawn casual
  "Permanent Marker",   // Bold marker style
  "Kalam",              // Handwritten casual
  "Shadows Into Light", // Playful handwriting
  
  // === CLEAN SANS-SERIF ===
  "Roboto",             // Modern geometric (most popular)
  "Open Sans",          // Friendly humanist sans
  "Montserrat",         // Urban geometric sans
  "Poppins",            // Geometric with Indian influence
  "Raleway",            // Elegant thin geometric
  "Lato",               // Warm humanist sans
  "Nunito",             // Rounded terminal sans
  "Work Sans",          // Workhorse grotesque
  "Manrope",            // Modern low-contrast
  "DM Sans",            // Geometric with character
  "Space Grotesk",      // Proportional monospace
  "Inter",              // Screen-optimized sans
  
  // === SLAB SERIF ===
  "Roboto Slab",        // Friendly mechanical slab
  "Zilla Slab",         // Contemporary slab
  "Arvo",               // Geometric slab serif
  "Bitter",             // Narrow slab serif
  "Crete Round",        // Warm slab serif
  
  // === MONOSPACE & TECH ===
  "Roboto Mono",        // Monospaced geometric
  "Space Mono",         // Retro-futuristic mono
  "IBM Plex Mono",      // Professional monospace
  "Courier Prime",      // Typewriter style
  "Source Code Pro",    // Clean code font
  
  // === DECORATIVE & SPECIALTY ===
  "Bangers",            // Comic book style
  "Passion One",        // Condensed impact
  "Monoton",            // Art deco inline
  "Cinzel",             // Roman capitals
  "Audiowide",          // Sci-fi tech
  "Bungee Shade",       // 3D shadow effect
  "Russo One",          // Sans-serif with character
  "Press Start 2P",     // 8-bit pixel font
  "Orbitron",           // Geometric futuristic
  "Staatliches",        // Condensed display
  
  // === EXISTING TEMPLATE FONTS ===
  "Aladin", "Arizonia", "Baumans", "Berkshire Swash",
  "Bungee Inline", "Caveat Brush", "Coda Caption", "Cookie",
  "Damion", "Delius Swash Caps", "Ewert", "Faster One",
  "Flamenco", "Fredericka the Great", "Frijole", "Handlee",
  "Holtwood One SC", "Josefin Slab", "Keania One", "Londrina Shadow",
  "Niconne", "Nosifer", "Patua One", "Racing Sans One",
  "Rubik Mono One", "Slabo 27px", "Suez One", "Tangerine",
  "Titillium Web", "Vast Shadow", "Vinhan", "Yellowtail",
  "Yesteryear", "Zilla Slab Highlight",
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
