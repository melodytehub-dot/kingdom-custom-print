export type SizeKey = "S" | "M" | "L" | "XL" | "2XL";
export type ProductKind = "tee" | "hoodie" | "crew" | "cap" | "mug";

export interface Colorway { id: string; name: string; hex: string; }
export interface Product {
  slug: string; name: string; kind: "tee" | "hoodie" | "cap" | "mug" | "crew";
  basePrice: number; compareAt?: number; badge?: string;
  blurb: string; colors: Colorway[]; sizes: SizeKey[];
  printFeePerSide: number; rating?: number;
}

export const COLORWAYS: Record<string, Colorway[]> = {
  tee: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "white", name: "White", hex: "#f4f2ec" },
    { id: "sand", name: "Sand", hex: "#d8cbb6" },
    { id: "forest", name: "Forest", hex: "#24402f" }
  ],
  hoodie: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "charcoal", name: "Charcoal", hex: "#3a3a3c" },
    { id: "oat", name: "Oat", hex: "#ddd3c2" }
  ],
  cap: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "olive", name: "Olive", hex: "#4a4a33" }
  ],
  mug: [{ id: "white", name: "White", hex: "#f4f2ec" }, { id: "black", name: "Black", hex: "#171717" }],
  crew: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "navy", name: "Navy", hex: "#24304d" }
  ]
};

export const PRODUCTS: Product[] = [
  {
    slug: "crown-classic-tee", name: "Crown Classic Tee", kind: "tee",
    basePrice: 24, compareAt: 29, badge: "Best seller",
    blurb: "Heavyweight 220 GSM cotton tee with a structured collar. Our most reordered blank for everyday custom prints.",
    colors: COLORWAYS.tee, sizes: ["S", "M", "L", "XL", "2XL"], printFeePerSide: 6, rating: 4.9
  },
  {
    slug: "legacy-graphic-tee", name: "Legacy Graphic Tee", kind: "tee",
    basePrice: 28, badge: "New",
    blurb: "Soft-washed tee built for detailed back prints and chest marks.",
    colors: COLORWAYS.tee, sizes: ["S", "M", "L", "XL", "2XL"], printFeePerSide: 6, rating: 4.8
  },
  {
    slug: "minimalist-hoodie", name: "Minimalist Hoodie", kind: "hoodie",
    basePrice: 49, compareAt: 58, badge: "Sale",
    blurb: "Brushed-back fleece hoodie with double-lined hood. Holds embroidery-style and large front prints.",
    colors: COLORWAYS.hoodie, sizes: ["S", "M", "L", "XL", "2XL"], printFeePerSide: 9, rating: 4.9
  },
  {
    slug: "essential-crew", name: "Essential Crew", kind: "crew",
    basePrice: 44,
    blurb: "Midweight crewneck with ribbed cuffs. A clean surface for left-chest or full-front designs.",
    colors: COLORWAYS.crew, sizes: ["S", "M", "L", "XL", "2XL"], printFeePerSide: 8, rating: 4.7
  },
  {
    slug: "urban-snapback", name: "Urban Snapback", kind: "cap",
    basePrice: 24,
    blurb: "Structured six-panel cap with a flat printable front panel.",
    colors: COLORWAYS.cap, sizes: ["S", "M", "L"], printFeePerSide: 7, rating: 4.6
  },
  {
    slug: "kingdom-mug", name: "Kingdom Mug 11oz", kind: "mug",
    basePrice: 16,
    blurb: "Ceramic 11oz mug with a wraparound print area for logos and artwork.",
    colors: COLORWAYS.mug, sizes: ["S"], printFeePerSide: 5, rating: 4.8
  }
];

export function getProduct(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug) ?? PRODUCTS[0];
}
