export type ProductKind =
  | "tee"
  | "longsleeve"
  | "hoodie"
  | "crew"
  | "cap"
  | "mug"
  | "tote";

export type GarmentSide = "front" | "back";

export interface ProductColor {
  id: number;
  slug: string;
  name: string;
  hex: string;
}

export interface ProductSize {
  id: number;
  label: string;
  surcharge: number;
}

export interface PriceBreak {
  minQty: number;
  amountOff: number;
}

/**
 * Print area expressed as a fraction of the garment artwork box, so the
 * customizer can constrain art without knowing pixel dimensions.
 */
export interface PrintArea {
  frontW: number;
  frontH: number;
  backW: number;
  backH: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  kind: ProductKind;
  categoryId: number | null;
  categorySlug: string | null;
  categoryName: string | null;
  blurb: string;
  description: string;
  material: string;
  basePrice: number;
  compareAt: number | null;
  printFeePerSide: number;
  printArea: PrintArea;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  colors: ProductColor[];
  sizes: ProductSize[];
  priceBreaks: PriceBreak[];
  images: { id: number; url: string; alt: string }[];
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  productCount?: number;
}

/* -------------------------------------------------------------------------
   Customizer design payload
   ------------------------------------------------------------------------- */

export interface TextLayer {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  font: string;
  fontSize: number;
  color: string;
  weight: 400 | 700 | 900;
  italic: boolean;
  uppercase: boolean;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
}

export interface ImageLayer {
  id: string;
  type: "image";
  src: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export type DesignLayer = TextLayer | ImageLayer;

export type Design = Record<GarmentSide, DesignLayer[]>;

/* -------------------------------------------------------------------------
   Cart + order
   ------------------------------------------------------------------------- */

export interface SizeLine {
  label: string;
  qty: number;
}

export interface CartItem {
  /** Stable identity for a configured garment, so the same design is not merged. */
  id: string;
  productId: number;
  productSlug: string;
  productName: string;
  productKind: ProductKind;
  colorSlug: string;
  colorName: string;
  colorHex: string;
  sidesUsed: GarmentSide[];
  design: Design;
  previewFront: string | null;
  previewBack: string | null;
  lines: SizeLine[];
  /** Per-size surcharge by label, so the cart can reprice a changed size run. */
  surcharges: Record<string, number>;
  /** Per-garment price before size surcharges. */
  unitPrice: number;
  total: number;
  quantity: number;
  createdAt: number;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "in_proof"
  | "in_production"
  | "shipped"
  | "cancelled";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "in_proof", label: "Proof sent" },
  { value: "in_production", label: "In production" },
  { value: "shipped", label: "Shipped" },
  { value: "cancelled", label: "Cancelled" },
];

/** Brief text summary of a design, shown on order rows and in the cart. */
export function describeDesign(design: Design): string {
  const parts: string[] = [];
  for (const side of ["front", "back"] as const) {
    const layers = design[side] ?? [];
    if (!layers.length) continue;
    const texts = layers.filter((l) => l.type === "text").length;
    const images = layers.length - texts;
    const bits: string[] = [];
    if (texts) bits.push(`${texts} text`);
    if (images) bits.push(`${images} image${images > 1 ? "s" : ""}`);
    parts.push(`${side[0].toUpperCase()}${side.slice(1)}: ${bits.join(", ")}`);
  }
  return parts.length ? parts.join(" · ") : "Blank";
}