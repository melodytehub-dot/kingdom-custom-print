import postgres from "postgres";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
try {
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id text`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id text`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_idx ON orders (paypal_order_id) WHERE paypal_order_id IS NOT NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_capture_idx ON orders (paypal_capture_id) WHERE paypal_capture_id IS NOT NULL`;
  console.log("PayPal order columns are ready.");
} finally { await sql.end(); }
