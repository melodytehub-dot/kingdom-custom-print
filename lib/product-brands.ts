import type { Product } from "./types";

export const PRODUCT_BRANDS = [
  { slug: "bella-canvas", name: "BELLA+CANVAS" },
  { slug: "next-level", name: "Next Level" },
  { slug: "gildan", name: "Gildan" },
] as const;

const VERIFIED_STYLES: Record<string, (typeof PRODUCT_BRANDS)[number]["slug"]> = {
  G500: "gildan",
  G640: "gildan",
  G200: "gildan",
  G640L: "gildan",
  N6210: "next-level",
  "3001CVC": "bella-canvas",
  "3005": "bella-canvas",
};

export function brandForProduct(product: Pick<Product, "styleCode">) {
  return PRODUCT_BRANDS.find((brand) => brand.slug === VERIFIED_STYLES[product.styleCode.toUpperCase()]) ?? null;
}
