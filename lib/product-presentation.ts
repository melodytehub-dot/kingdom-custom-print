import type { Product } from "./types";

/** Catalog photography is independent from the isolated printable studio assets. */
export type ProductView = "front" | "back" | "side";
export const PRODUCT_VIEWS: ProductView[] = ["front", "back", "side"];

export function photographyFamily(product: Pick<Product, "slug" | "kind">): string | null {
  const special: Record<string, string> = {
    "v-neck-tee": "vneck", "pocket-tee": "pocket",
    "womens-fitted-tee": "fitted", "youth-classic-tee": "youth",
    "long-sleeve-tee": "longsleeve",
  };
  return special[product.slug] ?? ({ tee: "tee", longsleeve: "longsleeve", hoodie: "hoodie", crew: "crew" } as Record<string, string>)[product.kind] ?? null;
}
