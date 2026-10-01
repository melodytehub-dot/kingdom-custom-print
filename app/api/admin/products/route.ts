import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import {
  createProduct,
  deleteProduct,
  setProductActive,
  setProductFeatured,
  updateProduct,
  type ProductInput,
} from "@/lib/catalog";
import type { ProductKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: ProductKind[] = ["tee", "longsleeve", "hoodie", "crew", "cap", "mug", "tote"];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface RawProduct {
  id?: number;
  name?: string;
  slug?: string;
  kind?: string;
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
  colors?: { slug?: string; name?: string; hex?: string }[];
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

function validate(raw: RawProduct): { value?: ProductInput; error?: string } {
  const name = String(raw.name ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "Give the product a name." };

  const slug = slugify(String(raw.slug || name));
  if (!slug || !SLUG_RE.test(slug)) {
    return { error: "The URL slug can only contain letters, numbers and hyphens." };
  }

  if (!KINDS.includes(raw.kind as ProductKind)) {
    return { error: "Choose a valid product type." };
  }

  const colors = (raw.colors ?? [])
    .filter((c) => c && c.slug && c.name && HEX_RE.test(String(c.hex)))
    .slice(0, 24)
    .map((c) => ({
      slug: slugify(String(c.slug)),
      name: String(c.name).slice(0, 40),
      hex: String(c.hex).toLowerCase(),
    }));
  if (!colors.length) return { error: "Add at least one colour with a valid hex value." };

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
      kind: raw.kind as ProductKind,
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
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { value, error } = validate(raw);
  if (!value) return NextResponse.json({ error }, { status: 422 });

  try {
    const id = await createProduct(value);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "That URL slug is already used by another product."
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
    const ok = await updateProduct(id, value);
    if (!ok) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "That URL slug is already used by another product."
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
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Missing product id." }, { status: 422 });
  }

  const ok =
    typeof raw.featured === "boolean"
      ? await setProductFeatured(id, raw.featured)
      : typeof raw.active === "boolean"
        ? await setProductActive(id, raw.active)
        : false;

  if (!ok) return NextResponse.json({ error: "Product not found." }, { status: 404 });
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
  return NextResponse.json({ ok: true });
}