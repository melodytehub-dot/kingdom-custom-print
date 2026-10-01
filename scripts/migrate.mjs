import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes("--force");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });

async function main() {
  if (force) {
    console.log("Dropping existing tables...");
    await sql.unsafe(`
      DROP TABLE IF EXISTS order_items, orders, customers, admin_sessions,
        site_settings, product_images, price_breaks, product_sizes,
        product_colors, products, categories CASCADE;
      DROP FUNCTION IF EXISTS touch_updated_at() CASCADE;
    `);
  }

  const schema = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
  await sql.unsafe(schema);

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  console.log(`Schema applied. Tables: ${tables.map((t) => t.table_name).join(", ")}`);
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("Migration failed:", err.message);
    await sql.end();
    process.exit(1);
  });