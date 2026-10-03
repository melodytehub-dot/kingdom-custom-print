import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const repairs = [
  ["womens-fitted-tee", "/img/mockups/families/fitted/WHT_fr.webp", "Women's Fitted Tee in White"],
  ["youth-classic-tee", "/img/mockups/families/youth/WHT_fr.webp", "Youth Classic Tee in White"],
  ["v-neck-tee", "/img/mockups/families/vneck/WHT_fr.webp", "V-Neck Tee in White"],
  ["long-sleeve-tee", "/img/mockups/families/longsleeve/BLK_fr.webp", "Long Sleeve Tee in Black"],
];

await sql.begin(async (tx) => {
  for (const [slug, url, alt] of repairs) {
    const rows = await tx`
      UPDATE product_images SET url = ${url}, alt = ${alt}
      WHERE id = (
        SELECT pi.id FROM product_images pi
        JOIN products p ON p.id = pi.product_id
        WHERE p.slug = ${slug}
        ORDER BY pi.sort_order, pi.id
        LIMIT 1
      )
      RETURNING id`;
    console.log(`${rows.length ? "repaired" : "skipped"} ${slug}`);
  }
});

await sql.end();
