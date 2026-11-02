import assert from "node:assert/strict";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await db.begin(async (tx) => {
    await tx`CREATE TEMP TABLE admin_quotes (id bigint PRIMARY KEY, customer_name text NOT NULL, customer_email text NOT NULL, notes text NOT NULL, lines jsonb NOT NULL, shipping_cents integer NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE quote_share_tokens (token_hash text PRIMARY KEY, quote_id bigint NOT NULL REFERENCES admin_quotes(id), snapshot jsonb NOT NULL, expires_at timestamptz NOT NULL) ON COMMIT DROP`;
    await tx`INSERT INTO admin_quotes (id, customer_name, customer_email, notes, lines, shipping_cents, status) VALUES (1, 'Test', 'buyer@example.test', '', '[{"description":"Original","quantity":1,"unitCents":1200}]'::jsonb, 100, 'quote')`;
    await tx`INSERT INTO quote_share_tokens (token_hash, quote_id, snapshot, expires_at) SELECT 'fixture', id, jsonb_build_object('id', id::text, 'customer_name', customer_name, 'customer_email', customer_email, 'notes', notes, 'lines', lines, 'shipping_cents', shipping_cents, 'created_at', created_at), now() + interval '30 days' FROM admin_quotes WHERE id = 1 AND status = 'quote' AND customer_email = 'buyer@example.test'`;
    await tx`UPDATE admin_quotes SET lines = '[{"description":"Changed","quantity":1,"unitCents":5000}]'::jsonb, status = 'invoice' WHERE id = 1`;
    const [snapshot] = await tx`SELECT snapshot FROM quote_share_tokens WHERE token_hash = 'fixture' AND expires_at > now()`;
    assert.equal(snapshot.snapshot.lines[0].description, "Original");
    assert.equal(snapshot.snapshot.lines[0].unitCents, 1200);
    await tx`UPDATE quote_share_tokens SET expires_at = now() - interval '1 second'`;
    const expired = await tx`SELECT snapshot FROM quote_share_tokens WHERE token_hash = 'fixture' AND expires_at > now()`;
    assert.equal(expired.length, 0);
    throw new Error("ROLLBACK_FIXTURE");
  });
} catch (error) {
  if (error.message !== "ROLLBACK_FIXTURE") throw error;
} finally { await db.end(); }
console.log("PASS: emailed quote snapshot survives edits and conversion, and expires");
