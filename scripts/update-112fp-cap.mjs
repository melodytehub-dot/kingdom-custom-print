// Run after deploying the cap assets. Preserve recorded stock and fail safely
// if an old color already has inventory that needs the owner's review.
import postgres from "postgres";
import { additionalProducts } from "./additional-catalog.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const cap = additionalProducts.find((product) => product.slug === "five-panel-cap");
if (!cap) throw new Error("Cap configuration is missing");
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await sql.begin(async (tx) => {
    const [product] = await tx`SELECT id FROM products WHERE slug = ${cap.slug} FOR UPDATE`;
    if (!product) throw new Error("Five-panel cap was not found");
    const oldStock = await tx`SELECT color_name, size_label FROM inventory_stock
      WHERE product_id = ${product.id} AND color_name <> ALL(${tx.array(cap.colors.map((color) => color.name))})`;
    if (oldStock.length) throw new Error("Existing cap stock needs review before replacing its colors");
    await tx`UPDATE products SET name = ${cap.name}, style_code = ${cap.style}, material = ${cap.material},
      description = ${cap.description}, blurb = ${cap.blurb} WHERE id = ${product.id}`;
    await tx`UPDATE product_images SET url = ${cap.images[0].url}, alt = ${cap.images[0].alt}
      WHERE product_id = ${product.id} AND url = '/img/mockups/families/cap/BLK_fr.webp'`;
    await tx`DELETE FROM product_colors WHERE product_id = ${product.id} AND slug <> ALL(${tx.array(cap.colors.map((color) => color.slug))})`;
    for (const [index, color] of cap.colors.entries()) {
      await tx`INSERT INTO product_colors (product_id, slug, name, hex, sort_order)
        VALUES (${product.id}, ${color.slug}, ${color.name}, ${color.hex}, ${index})
        ON CONFLICT (product_id, slug) DO UPDATE SET name = EXCLUDED.name, hex = EXCLUDED.hex, sort_order = EXCLUDED.sort_order`;
    }
    console.log("Updated the 112FP cap; existing inventory records were preserved.");
  });
} finally {
  await sql.end();
}
