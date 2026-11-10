import variants from "./product-variant-manifest.json";

const capColors: Record<string, string> = {
  white: "#FFFFFF",
  "charcoal-white": "#444446",
  "navy-white": "#202B40",
  "black-white": "#151515",
  "heather-grey-black": "#A3A3A3",
  "ombre-blue-navy": "#3D465A",
};

/** Show both fabric and mesh colors for the trucker cap's two-tone options. */
export function swatchBackground(productSlug: string, colorSlug: string, hex: string): string {
  if (productSlug !== "five-panel-cap" || capColors[colorSlug]?.toLowerCase() !== hex.toLowerCase()) return hex;
  const mesh = colorSlug.endsWith("-white") ? "#ffffff" : colorSlug === "heather-grey-black" ? "#171717" : colorSlug === "ombre-blue-navy" ? "#1c263a" : null;
  return mesh ? `linear-gradient(135deg, ${hex} 50%, ${mesh} 50%)` : hex;
}

/** Return an image only while it matches the current catalog color. */
export function productVariantImage(productSlug: string, colorSlug: string, hex: string, view: "front" | "back"): string | null {
  if (productSlug === "five-panel-cap" && capColors[colorSlug]?.toLowerCase() === hex.toLowerCase()) {
    return `/img/mockups/112fp/${colorSlug}-${view}.webp`;
  }
  const expected = (variants as Record<string, Record<string, string>>)[productSlug]?.[colorSlug];
  if (!expected || expected.toLowerCase() !== hex.toLowerCase()) return null;
  return `/img/printed-catalog/${productSlug}/${colorSlug}${view === "back" ? "-back" : ""}.webp?v=variant-2`;
}
