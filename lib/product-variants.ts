import variants from "./product-variant-manifest.json";

/** Return an image only while it matches the current catalog color. */
export function productVariantImage(productSlug: string, colorSlug: string, hex: string, view: "front" | "back"): string | null {
  const expected = (variants as Record<string, Record<string, string>>)[productSlug]?.[colorSlug];
  if (!expected || expected.toLowerCase() !== hex.toLowerCase()) return null;
  return `/img/printed-catalog/${productSlug}/${colorSlug}${view === "back" ? "-back" : ""}.webp?v=variant-2`;
}
