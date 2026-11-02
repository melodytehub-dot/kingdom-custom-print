import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await db`CREATE TABLE IF NOT EXISTS admin_quotes (
    id bigserial PRIMARY KEY, customer_name text NOT NULL,
    customer_email text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
    lines jsonb NOT NULL, shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
    status text NOT NULL DEFAULT 'quote' CHECK (status IN ('quote', 'invoice')),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), invoiced_at timestamptz
  )`;
  await db`CREATE TABLE IF NOT EXISTS invoice_share_tokens (token_hash text PRIMARY KEY, quote_id bigint NOT NULL REFERENCES admin_quotes(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
  await db`CREATE INDEX IF NOT EXISTS invoice_share_tokens_quote_idx ON invoice_share_tokens (quote_id)`;
  await db`CREATE TABLE IF NOT EXISTS quote_share_tokens (token_hash text PRIMARY KEY, quote_id bigint NOT NULL REFERENCES admin_quotes(id) ON DELETE CASCADE, snapshot jsonb NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
  await db`CREATE INDEX IF NOT EXISTS quote_share_tokens_quote_idx ON quote_share_tokens (quote_id)`;
  await db`CREATE TABLE IF NOT EXISTS invoice_payment_attempts (id uuid PRIMARY KEY, quote_id bigint NOT NULL REFERENCES admin_quotes(id), provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')), amount_cents bigint NOT NULL CHECK (amount_cents > 0), state text NOT NULL DEFAULT 'creating' CHECK (state IN ('creating', 'open', 'paid', 'closed', 'refunded')), provider_id text UNIQUE, payment_id text, checkout_url text, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz)`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS invoice_payment_one_live ON invoice_payment_attempts (quote_id) WHERE state IN ('creating', 'open', 'paid', 'refunded')`;
  console.log("Quote table is ready.");
} finally { await db.end(); }
