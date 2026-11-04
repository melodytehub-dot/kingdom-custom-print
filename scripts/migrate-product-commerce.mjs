import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await sql.begin(async tx => {
    await tx`ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_mode text NOT NULL DEFAULT 'customizable'`;
    await tx`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_kind_check`;
    await tx`ALTER TABLE products ADD CONSTRAINT products_kind_check CHECK (kind IN ('tee','polo','longsleeve','hoodie','crew','cap','mug','tote','other'))`;
    await tx`ALTER TABLE product_colors ADD COLUMN IF NOT EXISTS front_image text`;
    await tx`ALTER TABLE product_colors ADD COLUMN IF NOT EXISTS back_image text`;
    await tx`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sale_mode text NOT NULL DEFAULT 'customizable'`;
    await tx`CREATE TABLE IF NOT EXISTS catalog_media (id text PRIMARY KEY, content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')), content bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
  });
  console.log("Product commerce schema is ready.");
} finally { await sql.end(); }
