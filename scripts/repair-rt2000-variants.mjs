import postgres from "postgres";
import { RT2000_COLORS, RT2000B_COLORS } from "./rt2000-colors.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const products = [
  {
    slug: "crown-classic-tee",
    colors: RT2000_COLORS,
    sizes: [
      ["S", 0], ["M", 0], ["L", 0], ["XL", 0], ["2XL", 3], ["3XL", 5],
      ["4XL", 7], ["5XL", 9], ["YXS", 0], ["YS", 0], ["YM", 0], ["YL", 0], ["YXL", 2],
    ],
  },
  {
    slug: "youth-classic-tee",
    colors: RT2000B_COLORS,
    sizes: [["YXS", 0], ["YS", 0], ["YM", 0], ["YL", 0], ["YXL", 2]],
  },
];

await sql.begin(async (tx) => {
  for (const product of products) {
    const rows = await tx`SELECT id FROM products WHERE slug = ${product.slug} LIMIT 1`;
    if (!rows.length) throw new Error(`${product.slug} was not found`);
    const productId = rows[0].id;

    await tx`DELETE FROM product_colors WHERE product_id = ${productId}`;
    await tx`DELETE FROM product_sizes WHERE product_id = ${productId}`;
    for (const [index, color] of product.colors.entries()) {
      await tx`
        INSERT INTO product_colors (product_id, slug, name, hex, sort_order)
        VALUES (${productId}, ${color.slug}, ${color.name}, ${color.hex}, ${index})`;
    }
    for (const [index, [label, surcharge]] of product.sizes.entries()) {
      await tx`
        INSERT INTO product_sizes (product_id, label, surcharge, sort_order)
        VALUES (${productId}, ${label}, ${surcharge}, ${index})`;
    }
    console.log(`repaired ${product.slug}: ${product.colors.length} colors, ${product.sizes.length} sizes`);
  }
});

await sql.end();
