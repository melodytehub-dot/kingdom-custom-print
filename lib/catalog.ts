import { sql, num } from "./db";
import type { SqlFragment } from "./sqlite";
import { HOMEPAGE_CONTENT_FIELDS, homepageContentFromSettings, type HomepageContent } from "./homepage-builder";
import type {
  Category,
  PriceBreak,
  PrintArea,
  Product,
  ProductKind,
  ProductSize,
} from "./types";

interface ProductRow {
  id: number;
  slug: string;
  name: string;
  style_code: string;
  kind: ProductKind;
  sale_mode: "customizable" | "ready-made";
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

const productColumns = () => sql`
  p.id, p.slug, p.name, p.style_code, p.kind, p.sale_mode, p.category_id,
  c.slug AS category_slug, c.name AS category_name,
  p.blurb, p.description, p.material,
  p.base_price, p.compare_at, p.print_fee_per_side, p.print_area,
  p.featured, p.active, p.sort_order
`;

type VariantRow = { id: number; product_id: number; slug: string; name: string; hex: string; front_image: string | null; back_image: string | null };
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
      colors: new Map<number, VariantRow[]>(),
      sizes: new Map<number, ProductSize[]>(),
      breaks: new Map<number, PriceBreak[]>(),
      images: new Map<number, Product["images"]>(),
    };
  }

  const [colorRows, sizeRows, breakRows, imageRows] = await Promise.all([
    sql<VariantRow[]>`
      SELECT id, product_id, slug, name, hex, front_image, back_image FROM product_colors
      WHERE product_id IN (${sql.array(ids)}) ORDER BY sort_order, id`,
    sql<SizeRow[]>`
      SELECT id, product_id, label, surcharge FROM product_sizes
      WHERE product_id IN (${sql.array(ids)}) ORDER BY sort_order, id`,
    sql<BreakRow[]>`
      SELECT product_id, min_qty, amount_off FROM price_breaks
      WHERE product_id IN (${sql.array(ids)}) ORDER BY min_qty DESC`,
    sql<ImageRow[]>`
      SELECT id, product_id, url, alt FROM product_images
      WHERE product_id IN (${sql.array(ids)}) ORDER BY sort_order, id`,
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
    saleMode: row.sale_mode,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    blurb: row.blurb,
    description: row.description,
    material: row.material,
    basePrice: num(row.base_price),
    compareAt: row.compare_at === null ? null : num(row.compare_at),
    printFeePerSide: num(row.print_fee_per_side),
    printArea: typeof row.print_area === "string" ? JSON.parse(row.print_area) as PrintArea : row.print_area,
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    colors: (colors.get(row.id) ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      hex: c.hex,
      frontImage: c.front_image,
      backImage: c.back_image,
      photos: (images.get(row.id) ?? []).filter(i => i.alt === `__color_gallery__:${c.slug}`).map(i => i.url),
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
    SELECT ${productColumns()}
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE (${options?.categorySlug ?? null} IS NULL OR c.slug = ${options?.categorySlug ?? null})
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
    SELECT ${productColumns()}
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
    SELECT ${productColumns()}
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
    { id: number; slug: string; name: string; description: string; sort_order: number; product_count: number }[]
  >`
    SELECT c.id, c.slug, c.name, c.description, c.sort_order,
      (SELECT count(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
    FROM categories c
    ORDER BY c.sort_order, c.id
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    productCount: r.product_count,
    sortOrder: r.sort_order,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const rows = await sql<
    { id: number; slug: string; name: string; description: string }[]
  >`SELECT id, slug, name, description FROM categories WHERE slug = ${slug} LIMIT 1`;
  return rows[0] ?? null;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export async function createCategory(input: CategoryInput): Promise<number> {
  const [row] = await sql<{ id: number }[]>`
    INSERT INTO categories (name, slug, description, sort_order)
    VALUES (${input.name}, ${input.slug}, ${input.description}, ${input.sortOrder})
    RETURNING id`;
  return row.id;
}

export async function updateCategory(id: number, input: CategoryInput): Promise<boolean> {
  const result = await sql`
    UPDATE categories
    SET name = ${input.name}, slug = ${input.slug}, description = ${input.description},
        sort_order = ${input.sortOrder}
    WHERE id = ${id}`;
  return result.count > 0;
}

export async function deleteCategory(id: number): Promise<boolean> {
  const result = await sql`DELETE FROM categories WHERE id = ${id}`;
  return result.count > 0;
}

/* -------------------------------------------------------------------------
   Admin writes
   ------------------------------------------------------------------------- */

export interface ProductInput {
  name: string;
  slug: string;
  styleCode: string;
  kind: ProductKind;
  saleMode: "customizable" | "ready-made";
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
  colors: { slug: string; name: string; hex: string; frontImage?: string | null; backImage?: string | null; photos?: string[] }[];
  sizes: { label: string; surcharge: number }[];
  priceBreaks: { minQty: number; amountOff: number }[];
}

export class ProductInventoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductInventoryConflictError";
  }
}

/**
 * Builds the statements that replace a product's colors, sizes and price
 * breaks. Callers run the returned list with `sql.batch` so the delete and the
 * inserts land together, which is the SQLite equivalent of the old transaction.
 *
 * `inventory_reservations` references `inventory_stock` with ON DELETE RESTRICT,
 * so a color or size that still holds stock for an order makes the batch fail
 * rather than silently dropping held inventory.
 */
async function variantStatements(productId: SqlFragment, input: ProductInput): Promise<SqlFragment[]> {
  const id = productId;
  // Inventory and payment holds use the displayed color and size names. Do not
  // leave a count behind that might later be mistaken for newly available stock.
  const oldColors = await sql<{ name: string }[]>`SELECT name FROM product_colors WHERE product_id = ${id}`;
  const oldSizes = await sql<{ label: string }[]>`SELECT label FROM product_sizes WHERE product_id = ${id}`;
  const stocks = await sql<{ color_name: string; size_label: string; quantity: number }[]>`
    SELECT color_name, size_label, quantity FROM inventory_stock WHERE product_id = ${id}`;
  const holds = await sql<{ color_name: string; size_label: string }[]>`
    SELECT color_name, size_label FROM inventory_reservations WHERE product_id = ${id}`;
  const oldColorNames = new Set(oldColors.map((c) => c.name));
  const oldSizeLabels = new Set(oldSizes.map((s) => s.label));
  const newColorNames = new Set(input.colors.map((c) => c.name));
  const newSizeLabels = new Set(input.sizes.map((s) => s.label));
  const existsBefore = (color: string, size: string) => oldColorNames.has(color) && oldSizeLabels.has(size);
  const existsAfter = (color: string, size: string) => newColorNames.has(color) && newSizeLabels.has(size);

  if (holds.some((row) => !existsAfter(row.color_name, row.size_label))) {
    throw new ProductInventoryConflictError("This option has stock held for a pending order. Resolve the order before changing or removing it.");
  }

  const statements: SqlFragment[] = [];
  for (const stock of stocks) {
    const before = existsBefore(stock.color_name, stock.size_label);
    const after = existsAfter(stock.color_name, stock.size_label);
    if (before && !after && stock.quantity > 0) {
      throw new ProductInventoryConflictError("Set the stock count to zero before changing or removing a color or size.");
    }
    if (!before && after) {
      throw new ProductInventoryConflictError("This option has an old stock count. Contact the site administrator to review it before adding the option.");
    }
    if (before && !after) {
      statements.push(sql`
        DELETE FROM inventory_stock
        WHERE product_id = ${id} AND color_name = ${stock.color_name} AND size_label = ${stock.size_label}`);
    }
  }

  statements.push(sql`DELETE FROM product_colors WHERE product_id = ${id}`);
  statements.push(sql`DELETE FROM product_sizes WHERE product_id = ${id}`);
  statements.push(sql`DELETE FROM price_breaks WHERE product_id = ${id}`);
  const updateGalleries = input.saleMode === "ready-made" && input.colors.some((color) => color.photos !== undefined);
  if (updateGalleries) {
    statements.push(sql`DELETE FROM product_images WHERE product_id = ${id} AND substr(alt, 1, 18) = '__color_gallery__:'`);
  }

  for (const [i, c] of input.colors.entries()) {
    statements.push(sql`
      INSERT INTO product_colors (product_id, slug, name, hex, sort_order, front_image, back_image)
      VALUES (${id}, ${c.slug}, ${c.name}, ${c.hex}, ${i}, ${c.frontImage ?? null}, ${c.backImage ?? null})`);
    if (updateGalleries) {
      for (const [index, url] of (c.photos ?? []).entries()) {
        statements.push(sql`
          INSERT INTO product_images (product_id, url, alt, sort_order)
          VALUES (${id}, ${url}, ${`__color_gallery__:${c.slug}`}, ${index})`);
      }
    }
  }

  for (const [i, s] of input.sizes.entries()) {
    statements.push(sql`
      INSERT INTO product_sizes (product_id, label, surcharge, sort_order)
      VALUES (${id}, ${s.label}, ${s.surcharge}, ${i})`);
  }

  for (const b of input.priceBreaks) {
    statements.push(sql`
      INSERT INTO price_breaks (product_id, min_qty, amount_off)
      VALUES (${id}, ${b.minQty}, ${b.amountOff})`);
  }

  return statements;
}

export async function createProduct(input: ProductInput): Promise<number> {
  // The product row goes in first, then variants reference it by slug, which is
  // unique, so the whole thing can run as one atomic batch without RETURNING.
  const id = sql`(SELECT id FROM products WHERE slug = ${input.slug})`;
  const statements: SqlFragment[] = [
    sql`
      INSERT INTO products (slug, name, style_code, category_id, kind, sale_mode, blurb, description, material,
        base_price, compare_at, print_fee_per_side, print_area, featured, active)
      VALUES (${input.slug}, ${input.name}, ${input.styleCode}, ${input.categoryId}, ${input.kind}, ${input.saleMode},
        ${input.blurb}, ${input.description}, ${input.material}, ${input.basePrice},
        ${input.compareAt}, ${input.printFeePerSide}, ${sql.json(input.printArea)},
        ${input.featured}, ${input.active})`,
  ];
  statements.push(...(await variantStatements(id, input)));
  await sql.batch(statements);
  const [row] = await sql<{ id: number }[]>`SELECT id FROM products WHERE slug = ${input.slug}`;
  return row.id;
}

export async function updateProduct(
  id: number,
  input: ProductInput
): Promise<boolean> {
  const existing = await sql<{ id: number }[]>`SELECT id FROM products WHERE id = ${id}`;
  if (!existing.length) return false;

  const productId = sql`${id}`;
  const statements: SqlFragment[] = [
    sql`
      UPDATE products SET
        slug = ${input.slug}, name = ${input.name}, style_code = ${input.styleCode},
        category_id = ${input.categoryId},
        kind = ${input.kind}, sale_mode = ${input.saleMode}, blurb = ${input.blurb}, description = ${input.description},
        material = ${input.material}, base_price = ${input.basePrice},
        compare_at = ${input.compareAt}, print_fee_per_side = ${input.printFeePerSide},
        print_area = ${sql.json(input.printArea)}, featured = ${input.featured},
        active = ${input.active}
      WHERE id = ${productId}`,
  ];
  statements.push(...(await variantStatements(productId, input)));
  await sql.batch(statements);
  return true;
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
  heroLabel: string;
  heroHeadlineTop: string;
  heroHeadlineBottom: string;
  heroDescription: string;
  heroImage1: string;
  heroImage2: string;
  heroImage3: string;
  homeProductsTitle: string;
  homeProductsDescription: string;
  homeContactTitle: string;
  homeContactDescription: string;
  announcement: string;
  announcementLink: string;
  footerBlurb: string;
  shippingFlat: number;
  freeShippingThreshold: number;
  contactEmail: string;
  contactPhone: string;
  businessAddress: string;
  productionDays: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  heroLabel: "PRINT ON DEMAND STUDIO",
  heroHeadlineTop: "YOUR IDEAS.",
  heroHeadlineBottom: "MADE TO WEAR.",
  heroDescription: "Custom apparel for your everyday, your brand, or your team. Design it online. Make it yours.",
  heroImage1: "/img/shop-studio.png",
  heroImage2: "/img/shop-printing.png",
  heroImage3: "/img/kingdom-team.webp",
  homeProductsTitle: "MAKE IT YOURS",
  homeProductsDescription: "Find your fit. Choose a color. Create something only you could make.",
  homeContactTitle: "READY TO ORDER?",
  homeContactDescription: "Bulk order, team gear, or a one-off run — send us the details and we will give you a straight answer on timing and pricing.",
  announcement: "Free US shipping on orders over $75",
  announcementLink: "/shop",
  footerBlurb: "Custom apparel for your ideas, your team, and your everyday. Choose a garment and make it yours in our online design studio.",
  shippingFlat: 6.95,
  freeShippingThreshold: 75,
  contactEmail: "",
  contactPhone: "",
  businessAddress: "",
  productionDays: "3-5 business days after artwork approval",
};

/** `site_settings.value` is JSON text, so every read parses it first. */
export function parseSettingValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export async function getSettings(): Promise<SiteSettings> {
  const rows = await sql<{ key: string; value: unknown }[]>`
    SELECT key, value FROM site_settings`;
  const map = new Map(rows.map((r) => [r.key, parseSettingValue(r.value)]));
  return {
    heroLabel: String(map.get("hero_label") ?? DEFAULT_SETTINGS.heroLabel),
    heroHeadlineTop: String(map.get("hero_headline_top") ?? DEFAULT_SETTINGS.heroHeadlineTop),
    heroHeadlineBottom: String(map.get("hero_headline_bottom") ?? DEFAULT_SETTINGS.heroHeadlineBottom),
    heroDescription: String(map.get("hero_description") ?? DEFAULT_SETTINGS.heroDescription),
    heroImage1: String(map.get("hero_image_1") ?? DEFAULT_SETTINGS.heroImage1),
    heroImage2: String(map.get("hero_image_2") ?? DEFAULT_SETTINGS.heroImage2),
    heroImage3: String(map.get("hero_image_3") ?? DEFAULT_SETTINGS.heroImage3),
    homeProductsTitle: String(map.get("home_products_title") ?? DEFAULT_SETTINGS.homeProductsTitle),
    homeProductsDescription: String(map.get("home_products_description") ?? DEFAULT_SETTINGS.homeProductsDescription),
    homeContactTitle: String(map.get("home_contact_title") ?? DEFAULT_SETTINGS.homeContactTitle),
    homeContactDescription: String(map.get("home_contact_description") ?? DEFAULT_SETTINGS.homeContactDescription),
    announcement: String(map.get("announcement") ?? DEFAULT_SETTINGS.announcement),
    announcementLink: String(map.get("announcement_link") ?? DEFAULT_SETTINGS.announcementLink),
    footerBlurb: String(map.get("footer_blurb") ?? DEFAULT_SETTINGS.footerBlurb),
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

export class HomepageContentConflict extends Error {}

export async function saveSettings(settings: SiteSettings, expectedHomepage?: HomepageContent): Promise<void> {
  if (expectedHomepage) {
    const rows = await sql<{ key: string; value: unknown }[]>`SELECT key, value FROM site_settings`;
    const values = new Map(rows.map((row) => [row.key, parseSettingValue(row.value)]));
    const current = homepageContentFromSettings(DEFAULT_SETTINGS);
    for (const field of HOMEPAGE_CONTENT_FIELDS) current[field.name] = String(values.get(field.dbKey) ?? current[field.name]);
    if (JSON.stringify(current) !== JSON.stringify(expectedHomepage)) throw new HomepageContentConflict();
  }

  const entries: [string, unknown][] = [
    ["hero_label", settings.heroLabel],
    ["hero_headline_top", settings.heroHeadlineTop],
    ["hero_headline_bottom", settings.heroHeadlineBottom],
    ["hero_description", settings.heroDescription],
    ["hero_image_1", settings.heroImage1],
    ["hero_image_2", settings.heroImage2],
    ["hero_image_3", settings.heroImage3],
    ["home_products_title", settings.homeProductsTitle],
    ["home_products_description", settings.homeProductsDescription],
    ["home_contact_title", settings.homeContactTitle],
    ["home_contact_description", settings.homeContactDescription],
    ["announcement", settings.announcement],
    ["announcement_link", settings.announcementLink],
    ["footer_blurb", settings.footerBlurb],
    ["shipping_flat", settings.shippingFlat],
    ["free_shipping_threshold", settings.freeShippingThreshold],
    ["contact_email", settings.contactEmail],
    ["contact_phone", settings.contactPhone],
    ["business_address", settings.businessAddress],
    ["production_days", settings.productionDays],
  ];

  await sql.batch(
    entries.map(([key, value]) => sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (${key}, ${sql.json(value)}, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT (key) DO UPDATE
        SET value = excluded.value, updated_at = excluded.updated_at`)
  );
}


