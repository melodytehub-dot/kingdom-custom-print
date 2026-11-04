import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../_guard";
import {
  createProduct,
  getProductById,
  deleteProduct,
  setProductActive,
  setProductFeatured,
  updateProduct,
  type ProductInput,
} from "@/lib/catalog";
import type { ProductKind } from "@/lib/types";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const KINDS: ProductKind[] = ["tee", "polo", "longsleeve", "hoodie", "crew", "cap", "mug", "tote", "other"];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface RawProduct {
  id?: number;
  name?: string;
  slug?: string;
  styleCode?: string;
  kind?: string;
  saleMode?: string;
  categoryId?: number | null;
  blurb?: string;
  description?: string;
  material?: string;
  basePrice?: number | string;
  compareAt?: number | string | null;
  printFeePerSide?: number | string;
  printArea?: Record<string, number>;
  featured?: boolean;
  active?: boolean;
  colors?: { slug?: string; name?: string; hex?: string; frontImage?: string | null; backImage?: string | null }[];
  sizes?: { label?: string; surcharge?: number }[];
  priceBreaks?: { minQty?: number; amountOff?: number }[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function photosExist(product: ProductInput): Promise<boolean> {
  const ids = [...new Set(product.colors.flatMap(color => [color.frontImage, color.backImage]).filter((url): url is string => Boolean(url)).map(url => url.split("/").pop()!))];
  if (!ids.length) return true;
  const rows = await sql<{ id: string }[]>`SELECT id FROM catalog_media WHERE id IN (SELECT jsonb_array_elements_text(${sql.json(ids)}::jsonb))`;
  return rows.length === ids.length;
}

function validate(raw: RawProduct): { value?: ProductInput; error?: string } {
  const name = String(raw.name ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "Give the product a name." };

  const slug = slugify(String(raw.slug || name));
  if (!slug || !SLUG_RE.test(slug)) {
    return { error: "Use a product name containing letters or numbers." };
  }

  if (!KINDS.includes(raw.kind as ProductKind)) {
    return { error: "Choose a valid product type." };
  }
  const saleMode = raw.saleMode ?? "customizable";
  if (saleMode !== "customizable" && saleMode !== "ready-made") return { error: "Choose how this product is sold." };
  if (raw.kind === "other" && saleMode !== "ready-made") return { error: "Choose a garment type for products customers can customize." };
  const validPhoto = (url: unknown) => url == null || url === "" || (typeof url === "string" && /^\/api\/product-media\/[0-9a-f-]{36}$/i.test(url));

  if (!Array.isArray(raw.colors) || !raw.colors.length || raw.colors.length > 200) return { error: "Add between 1 and 200 colors." };
  if (raw.colors.some((c) => !c || typeof c.slug !== "string" || !c.slug || typeof c.name !== "string" || !c.name.trim() || !HEX_RE.test(String(c.hex)))) return { error: "Give each color a name and choose a swatch color." };
  if (raw.colors.some(c => !validPhoto(c.frontImage) || !validPhoto(c.backImage))) return { error: "Upload the product photos again." };
  if (saleMode === "ready-made" && raw.active !== false && raw.colors.some(c => !c.frontImage)) return { error: "Add a front photo for each color before publishing." };
  const colors = raw.colors.map((c) => ({
      slug: slugify(String(c.slug)),
      name: String(c.name).slice(0, 40),
      hex: String(c.hex).toLowerCase(),
      frontImage: c.frontImage || null,
      backImage: c.backImage || null,
    }));
  if (!colors.length) return { error: "Add at least one color with a valid hex value." };
  const seenColors = new Set<string>();
  for (const color of colors) {
    if (!color.slug) return { error: "Each color needs a name containing letters or numbers." };
    if (seenColors.has(color.slug)) return { error: "Give each color a different name." };
    seenColors.add(color.slug);
  }

  if (raw.sizes !== undefined && !Array.isArray(raw.sizes)) return { error: "Add at least one size." };
  if (raw.priceBreaks !== undefined && !Array.isArray(raw.priceBreaks)) return { error: "Check the quantity breaks." };
  const sizes = (raw.sizes ?? [])
    .filter((s) => s && s.label)
    .slice(0, 20)
    .map((s) => ({
      label: String(s.label).trim().slice(0, 20),
      surcharge: Math.max(0, Math.min(999, Number(s.surcharge) || 0)),
    }));
  if (!sizes.length) return { error: "Add at least one size." };

  const seenSizes = new Set<string>();
  for (const s of sizes) {
    if (seenSizes.has(s.label)) return { error: `Size “${s.label}” is listed twice.` };
    seenSizes.add(s.label);
  }

  const priceBreaks = (raw.priceBreaks ?? [])
    .filter((b) => b && Number(b.minQty) > 0)
    .slice(0, 20)
    .map((b) => ({
      minQty: Math.max(1, Math.min(9999, Math.floor(Number(b.minQty)))),
      amountOff: Number(b.amountOff) || 0,
    }))
    .sort((a, b) => a.minQty - b.minQty);

  const basePrice = Number(raw.basePrice);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { error: "Enter a valid base price." };
  }

  const compareRaw = raw.compareAt;
  const compareAt =
    compareRaw === null || compareRaw === undefined || compareRaw === ""
      ? null
      : Number(compareRaw);
  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt < basePrice)) {
    return { error: "The compare-at price must be higher than the base price." };
  }

  const pa = raw.printArea ?? {};
  const frac = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(0.98, Math.max(0.05, n)) : fallback;
  };

  return {
    value: {
      name,
      slug,
      styleCode: String(raw.styleCode ?? "").trim().slice(0, 40),
      kind: raw.kind as ProductKind,
      saleMode,
      categoryId: raw.categoryId ? Number(raw.categoryId) : null,
      blurb: String(raw.blurb ?? "").trim().slice(0, 400),
      description: String(raw.description ?? "").trim().slice(0, 6000),
      material: String(raw.material ?? "").trim().slice(0, 200),
      basePrice: Math.round(basePrice * 100) / 100,
      compareAt: compareAt === null ? null : Math.round(compareAt * 100) / 100,
      printFeePerSide:
        Math.max(0, Math.min(999, Number(raw.printFeePerSide) || 0)),
      printArea: {
        frontW: frac(pa.frontW, 0.42),
        frontH: frac(pa.frontH, 0.5),
        backW: frac(pa.backW, 0.62),
        backH: frac(pa.backH, 0.66),
      },
      featured: Boolean(raw.featured),
      active: raw.active === undefined ? true : Boolean(raw.active),
      colors,
      sizes,
      priceBreaks,
    },
  };
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let raw: RawProduct;
  try {
    raw = (await req.json()) as RawProduct;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { value, error } = validate(raw);
  if (!value) return NextResponse.json({ error }, { status: 422 });

  try {
    if (!(await photosExist(value))) return NextResponse.json({ error: "One or more photos are missing. Please upload them again." }, { status: 422 });
    const id = await createProduct(value);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "A product with this name or link already exists."
        : "The product could not be saved.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let raw: RawProduct;
  try {
    raw = (await req.json()) as RawProduct;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Missing product id." }, { status: 422 });
  }

  const { value, error } = validate(raw);
  if (!value) return NextResponse.json({ error }, { status: 422 });

  try {
    if (!(await photosExist(value))) return NextResponse.json({ error: "One or more photos are missing. Please upload them again." }, { status: 422 });
    const ok = await updateProduct(id, value);
    if (!ok) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.name === "ProductInventoryConflictError") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "A product with this name or link already exists."
        : "The product could not be saved.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let raw: { id?: number; featured?: boolean; active?: boolean };
  try {
    raw = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Missing product id." }, { status: 422 });
  }

  if (raw.active === true) {
    const product = await getProductById(id);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (product.saleMode === "ready-made" && product.colors.some(color => !color.frontImage)) {
      return NextResponse.json({ error: "Add a front photo for each color before publishing." }, { status: 422 });
    }
  }

  const ok =
    typeof raw.featured === "boolean"
      ? await setProductFeatured(id, raw.featured)
      : typeof raw.active === "boolean"
        ? await setProductActive(id, raw.active)
        : false;

  if (!ok) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Missing product id." }, { status: 422 });
  }

  const ok = await deleteProduct(id);
  if (!ok) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
