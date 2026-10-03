import postgres from "postgres";
import { additionalCategories, additionalProducts } from "./additional-catalog.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });

await sql.begin(async (tx) => {
  const categoryIds = new Map();
  for (const category of additionalCategories) {
    const [row] = await tx`
      INSERT INTO categories (slug, name, description, sort_order)
      VALUES (${category.slug}, ${category.name}, ${category.description}, ${category.sort})
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order
      RETURNING id`;
    categoryIds.set(category.slug, row.id);
  }

  for (const product of additionalProducts) {
    const existing = await tx`SELECT id FROM products WHERE slug = ${product.slug} LIMIT 1`;
    if (existing.length) {
      console.log(`skip ${product.slug} (already exists)`);
      continue;
    }

    const [row] = await tx`
      INSERT INTO products (slug, name, style_code, category_id, kind, blurb, description,
        material, base_price, compare_at, print_fee_per_side, print_area, featured, active, sort_order)
      VALUES (${product.slug}, ${product.name}, ${product.style}, ${categoryIds.get(product.category)},
        ${product.kind}, ${product.blurb}, ${product.description}, ${product.material},
        ${product.base_price}, ${product.compare_at}, ${product.print_fee},
        ${tx.json(product.print_area)}, ${product.featured}, true, ${product.sort})
      RETURNING id`;

    for (const [index, color] of product.colors.entries()) {
      await tx`
        INSERT INTO product_colors (product_id, slug, name, hex, sort_order)
        VALUES (${row.id}, ${color.slug}, ${color.name}, ${color.hex}, ${index})`;
    }
    for (const [index, size] of product.sizes.entries()) {
      await tx`
        INSERT INTO product_sizes (product_id, label, surcharge, sort_order)
        VALUES (${row.id}, ${size.label}, ${size.surcharge}, ${index})`;
    }
    for (const priceBreak of product.breaks) {
      await tx`
        INSERT INTO price_breaks (product_id, min_qty, amount_off)
        VALUES (${row.id}, ${priceBreak.min_qty}, ${priceBreak.off})`;
    }
    for (const [index, image] of product.images.entries()) {
      await tx`
        INSERT INTO product_images (product_id, url, alt, sort_order)
        VALUES (${row.id}, ${image.url}, ${image.alt}, ${index})`;
    }
    console.log(`added ${product.slug}`);
  }
});

await sql.end();
