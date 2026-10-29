import postgres from "postgres";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
try {
  await sql`CREATE TABLE IF NOT EXISTS payment_credentials (
    name text PRIMARY KEY, ciphertext text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  console.log("Payment credential table is ready.");
} finally { await sql.end(); }
