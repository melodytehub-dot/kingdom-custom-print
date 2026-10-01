import postgres from "postgres";
import { sql, num } from "./db";
import type {
  Category,
  PriceBreak,
  PrintArea,
  Product,
  ProductColor,
  ProductKind,
  ProductSize,
} from "./types";

interface ProductRow {
  id: number;
  slug: string;
  name: string;
  style_code: string;
  kind: ProductKind;
  category_id: number | null;
  category_slug: string | null;
  category_name: string | null;
  blurb: string;
  description: string;
  material: string;
  base_price: unknown;
  compare_at: unknown;
  print_fee_per_side: unknown;
  print_area: PrintArea;
  featured: boolean;
  active: boolean;
  sort_order: number;
}

const PRODUCT_COLUMNS = sql`
  p.id, p.slug, p.name, p.style_code, p.kind, p.category_id,
  c.slug AS category_slug, c.name AS category_name,
  p.blurb, p.description, p.material,
  p.base_price, p.compare_at, p.print_fee_per_side, p.print_area,
  p.featured, p.active, p.sort_order
`;

type VariantRow = { id: number; product_id: number; slug: string; name: string; hex: string };
type SizeRow = { id: number; product_id: number; label: string; surcharge: unknown };
type BreakRow = { product_id: number; min_qty: number; amount_off: unknown };
type ImageRow = { id: number; product_id: number; url: string; alt: string };

function groupByProduct<T extends { product_id: number }>(
  rows: T[],
  ids: number[]
): Map<number, T[]> {
  const map = new Map<number, T[]>(ids.map((id) => [id, []]));
  for (const row of rows) {
    const list = map.get(row.product_id);
    if (list) list.push(row);
  }
  return map;
}

async function loadVariants(ids: number[]) {
  if (!ids.length) {
    return {
      colors: new Map<number, ProductColor[]>(),
      sizes: new Map<number, ProductSize[]>(),
      breaks: new Map<number, PriceBreak[]>(),
      images: new Map<number, Product["images"]>(),
    };
  }

  const [colorRows, sizeRows, breakRows, imageRows] = await Promise.all([
    sql<VariantRow[]>`
      SELECT id, product_id, slug, name, hex FROM product_colors
      WHERE product_id = ANY(${ids}::int[]) ORDER BY sort_order, id`,
    sql<SizeRow[]>`
      SELECT id, product_id, label, surcharge FROM product_sizes
      WHERE product_id = ANY(${ids}::int[]) ORDER BY sort_order, id`,
    sql<BreakRow[]>`
      SELECT product_id, min_qty, amount_off FROM price_breaks
      WHERE product_id = ANY(${ids}::int[]) ORDER BY min_qty DESC`,
    sql<ImageRow[]>`
      SELECT id, product_id, url, alt FROM product_images
      WHERE product_id = ANY(${ids}::int[]) ORDER BY sort_order, id`,
  ]);

  return {
    colors: groupByProduct(colorRows, ids),
    sizes: groupByProduct(sizeRows, ids),
    breaks: groupByProduct(breakRows, ids),
    images: groupByProduct(imageRows, ids),
  };
}

function hydrate(row: ProductRow, variants: Awaited<ReturnType<typeof loadVariants>>): Product {
  const { colors, sizes, breaks, images } = variants;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    styleCode: row.style_code,
    kind: row.kind,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    blurb: row.blurb,
    description: row.description,
    material: row.material,
    basePrice: num(row.base_price),
    compareAt: row.compare_at === null ? null : num(row.compare_at),
    printFeePerSide: num(row.print_fee_per_side),
    printArea: row.print_area,
    featured: row.featured,
    active: row.active,
    sortOrder: row.sort_order,
    colors: (colors.get(row.id) ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      hex: c.hex,
    })),
    sizes: (sizes.get(row.id) ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      surcharge: num(s.surcharge),
    })),
    priceBreaks: (breaks.get(row.id) ?? []).map((b) => ({
      minQty: (b as BreakRow).min_qty,
      amountOff: num((b as BreakRow).amount_off),
    })),
    images: (images.get(row.id) ?? []).map((i) => ({
      id: i.id,
      url: i.url,
      alt: i.alt,
    })),
  };
}

export async function getProducts(options?: {
  featuredOnly?: boolean;
  categorySlug?: string;
  includeInactive?: boolean;
  limit?: number;
}): Promise<Product[]> {
  const activeFilter = options?.includeInactive ? sql`` : sql`AND p.active = true`;

  const rows = await sql<ProductRow[]>`
    SELECT ${PRODUCT_COLUMNS}
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE (${options?.categorySlug ?? null}::text IS NULL OR c.slug = ${options?.categorySlug ?? null})
      ${activeFilter}
      AND (${options?.featuredOnly ?? false} = false OR p.featured = true)
    ORDER BY p.sort_order, p.id
    ${options?.limit ? sql`LIMIT ${options.limit}` : sql``}
  `;

  const variants = await loadVariants(rows.map((r) => r.id));
  return rows.map((r) => hydrate(r, variants));
}

export async function getProductBySlug(
  slug: string,
  includeInactive = false
): Promise<Product | null> {
  const rows = await sql<ProductRow[]>`
    SELECT ${PRODUCT_COLUMNS}
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = ${slug} AND (${includeInactive} = true OR p.active = true)
    LIMIT 1
  `;
  if (!rows.length) return null;
  const variants = await loadVariants([rows[0].id]);
  return hydrate(rows[0], variants);
}

export async function getProductById(id: number): Promise<Product | null> {
  const rows = await sql<ProductRow[]>`
    SELECT ${PRODUCT_COLUMNS}
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const variants = await loadVariants([rows[0].id]);
  return hydrate(rows[0], variants);
}

export async function getCategories(): Promise<Category[]> {
  const rows = await sql<
    { id: number; slug: string; name: string; description: string; product_count: number }[]
  >`
    SELECT c.id, c.slug, c.name, c.description,
      (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.active) AS product_count
    FROM categories c
    ORDER BY c.sort_order, c.id
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    productCount: r.product_count,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const rows = await sql<
    { id: number; slug: string; name: string; description: string }[]
  >`SELECT id, slug, name, description FROM categories WHERE slug = ${slug} LIMIT 1`;
  return rows[0] ?? null;
}

/* -------------------------------------------------------------------------
   Admin writes
   ------------------------------------------------------------------------- */

export interface ProductInput {
  name: string;
  slug: string;
  styleCode: string;
  kind: ProductKind;
  categoryId: number | null;
  blurb: string;
  description: string;
  material: string;
  basePrice: number;
  compareAt: number | null;
  printFeePerSide: number;
  printArea: PrintArea;
  featured: boolean;
  active: boolean;
  colors: { slug: string; name: string; hex: string }[];
  sizes: { label: string; surcharge: number }[];
  priceBreaks: { minQty: number; amountOff: number }[];
}

/** postgres.js transaction handle; typed loosely because the library's
 *  begin() overloads do not narrow the callback parameter. */
type Tx = postgres.TransactionSql;

async function replaceVariants(productId: number, input: ProductInput, tx: Tx) {
  await tx`DELETE FROM product_colors WHERE product_id = ${productId}`;
  await tx`DELETE FROM product_sizes WHERE product_id = ${productId}`;
  await tx`DELETE FROM price_breaks WHERE product_id = ${productId}`;

  for (const [i, c] of input.colors.entries()) {
    await tx`
      INSERT INTO product_colors (product_id, slug, name, hex, sort_order)
      VALUES (${productId}, ${c.slug}, ${c.name}, ${c.hex}, ${i})`;
  }
  for (const [i, s] of input.sizes.entries()) {
    await tx`
      INSERT INTO product_sizes (product_id, label, surcharge, sort_order)
      VALUES (${productId}, ${s.label}, ${s.surcharge}, ${i})`;
  }
  for (const b of input.priceBreaks) {
    await tx`
      INSERT INTO price_breaks (product_id, min_qty, amount_off)
      VALUES (${productId}, ${b.minQty}, ${b.amountOff})`;
  }
}

/** postgres.js only accepts index-signature objects for json/jsonb params. */
function asJson(value: unknown) {
  return value as never;
}

export async function createProduct(input: ProductInput): Promise<number> {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: number }[]>`
      INSERT INTO products (slug, name, style_code, category_id, kind, blurb, description, material,
        base_price, compare_at, print_fee_per_side, print_area, featured, active)
      VALUES (${input.slug}, ${input.name}, ${input.styleCode}, ${input.categoryId}, ${input.kind},
        ${input.blurb}, ${input.description}, ${input.material}, ${input.basePrice},
        ${input.compareAt}, ${input.printFeePerSide}, ${tx.json(asJson(input.printArea))},
        ${input.featured}, ${input.active})
      RETURNING id`;
    await replaceVariants(row.id, input, tx);
    return row.id;
  });
}

export async function updateProduct(
  id: number,
  input: ProductInput
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const result = await tx`
      UPDATE products SET
        slug = ${input.slug}, name = ${input.name}, style_code = ${input.styleCode},
        category_id = ${input.categoryId},
        kind = ${input.kind}, blurb = ${input.blurb}, description = ${input.description},
        material = ${input.material}, base_price = ${input.basePrice},
        compare_at = ${input.compareAt}, print_fee_per_side = ${input.printFeePerSide},
        print_area = ${tx.json(asJson(input.printArea))}, featured = ${input.featured},
        active = ${input.active}
      WHERE id = ${id}`;
    if (result.count === 0) return false;
    await replaceVariants(id, input, tx);
    return true;
  });
}

export async function setProductActive(
  id: number,
  active: boolean
): Promise<boolean> {
  const result = await sql`
    UPDATE products SET active = ${active} WHERE id = ${id}`;
  return result.count > 0;
}

export async function setProductFeatured(
  id: number,
  featured: boolean
): Promise<boolean> {
  const result = await sql`
    UPDATE products SET featured = ${featured} WHERE id = ${id}`;
  return result.count > 0;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const result = await sql`DELETE FROM products WHERE id = ${id}`;
  return result.count > 0;
}

/* -------------------------------------------------------------------------
   Settings
   ------------------------------------------------------------------------- */

export interface SiteSettings {
  announcement: string;
  shippingFlat: number;
  freeShippingThreshold: number;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  productionDays: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  announcement: "Free US shipping on orders over $75",
  shippingFlat: 6.95,
  freeShippingThreshold: 75,
  contactEmail: "",
  contactPhone: "",
  businessAddress: "",
  productionDays: "3-5 business days after artwork approval",
};

export async function getSettings(): Promise<SiteSettings> {
  const rows = await sql<{ key: string; value: unknown }[]>`
    SELECT key, value FROM site_settings`;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    announcement: String(map.get("announcement") ?? DEFAULT_SETTINGS.announcement),
    shippingFlat: num(map.get("shipping_flat") ?? DEFAULT_SETTINGS.shippingFlat),
    freeShippingThreshold: num(
      map.get("free_shipping_threshold") ?? DEFAULT_SETTINGS.freeShippingThreshold
    ),
    contactEmail: String(map.get("contact_email") ?? ""),
    contactPhone: String(map.get("contact_phone") ?? ""),
    businessAddress: String(map.get("business_address") ?? ""),
    productionDays: String(map.get("production_days") ?? DEFAULT_SETTINGS.productionDays),
  };
}

export async function saveSettings(settings: SiteSettings): Promise<void> {
  await sql.begin(async (tx) => {
    const entries: [string, unknown][] = [
      ["announcement", settings.announcement],
      ["shipping_flat", settings.shippingFlat],
      ["free_shipping_threshold", settings.freeShippingThreshold],
      ["contact_email", settings.contactEmail],
      ["contact_phone", settings.contactPhone],
      ["business_address", settings.businessAddress],
      ["production_days", settings.productionDays],
    ];
    for (const [key, value] of entries) {
      await tx`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (${key}, ${tx.json(asJson(value))}, now())
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = now()`;
    }
  });
}