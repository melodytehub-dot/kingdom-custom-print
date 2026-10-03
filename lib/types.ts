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
  styleCode: string;
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
  sortOrder?: number;
}

/* -------------------------------------------------------------------------
   Customizer design payload
   ------------------------------------------------------------------------- */

/** Fields every layer shares, so the canvas can move/scale/rotate any of them. */
export interface BaseLayer {
  id: string;
  x: number;
  y: number;
  /** Horizontal/vertical stretch, multiplied on top of the layer's base size. */
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  flipH: boolean;
  flipV: boolean;
  /** Locked layers cannot be dragged, stretched or rotated until unlocked. */
  locked?: boolean;
  /** Distress level 0 (clean) to 3 (heavy) — knocks speckles out of the print. */
  distress?: number;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  font: string;
  fontSize: number;
  color: string;
  weight: 400 | 700 | 900;
  italic: boolean;
  uppercase: boolean;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  /** Outline / stroke drawn behind the fill. */
  strokeColor: string;
  /** Stroke width as a percentage of the font size (0 = no outline). */
  strokeWidth: number;
  /** Curve of the text: -100 (smile) … 0 (straight) … 100 (rainbow). */
  arc: number;
  /** Marks a layer as a team name or number so the roster drives its text. */
  role?: "name" | "number" | "subtitle";
}

/** Non-destructive edits applied to an uploaded image's original pixels. */
export interface ImageFx {
  filter: "normal" | "single";
  /** Ink colour used by the single-colour filter. */
  inkColor: string;
  removeBg: boolean;
  crop: boolean;
  superRes: boolean;
  /** Colour swaps chosen in "Edit Colors". */
  recolors: { from: string; to: string }[];
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  /** The pixels currently shown (original with `fx` applied). */
  src: string;
  name: string;
  /** Width / height of `src`, so the handles hug the artwork. */
  aspect: number;
  /** Untouched upload, kept so edits can be re-applied or undone. */
  origSrc?: string;
  fx?: ImageFx;
}

export type DesignLayer = TextLayer | ImageLayer;

export type Design = Record<GarmentSide, DesignLayer[]>;

/** A single row of a team roster, used by the names & numbers tool. */
export interface RosterEntry {
  id: string;
  name: string;
  number: string;
  subtitle?: string;
  size?: string;
}

export type PersonalizationKind = "none" | "names" | "numbers" | "both";

export interface NameNumberStyle {
  font: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
}

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
  /** Per-shirt names/numbers captured by the names & numbers tool. */
  roster?: RosterEntry[];
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
