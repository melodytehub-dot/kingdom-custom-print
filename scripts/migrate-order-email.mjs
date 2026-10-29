import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await sql`CREATE TABLE IF NOT EXISTS order_email_receipts (
    reference text PRIMARY KEY REFERENCES orders(reference) ON DELETE CASCADE,
    provider_id text NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now()
  )`;
  console.log("Order email receipt table is ready.");
} finally {
  await sql.end();
}
