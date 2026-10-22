import manifest from "./printed-catalog-manifest.json";

export function printedCatalogImage(productSlug: string, colorSlug: string): string | null {
  const colors = (manifest as Record<string, string[]>)[productSlug];
  return colors?.includes(colorSlug)
    ? `/img/printed-catalog/${productSlug}/${colorSlug}.webp?v=blank-1`
    : null;
}
