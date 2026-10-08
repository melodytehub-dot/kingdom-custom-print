import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const sizes = [
  ["S", 0],
  ["M", 0],
  ["L", 0],
  ["XL", 0],
  ["2XL", 3],
  ["3XL", 5],
  ["4XL", 7],
  ["5XL", 0],
  ["YXS", 0],
  ["YS", 0],
  ["YM", 0],
  ["YL", 0],
  ["YXL", 2],
];

await sql.begin(async (tx) => {
  const products = await tx`SELECT id FROM products WHERE slug = 'crown-classic-tee' LIMIT 1`;
  if (!products.length) throw new Error("crown-classic-tee was not found");

  const productId = products[0].id;
  await tx`DELETE FROM product_sizes WHERE product_id = ${productId}`;
  for (const [index, [label, surcharge]] of sizes.entries()) {
    await tx`
      INSERT INTO product_sizes (product_id, label, surcharge, sort_order)
      VALUES (${productId}, ${label}, ${surcharge}, ${index})`;
  }
  console.log(`repaired crown-classic-tee sizes — ${sizes.map(([label]) => label).join(", ")}`);
});

await sql.end();
