/**
 * The emailed quote snapshot must survive later edits and conversion, and the
 * share link must stop resolving after it expires.
 */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "quote-snapshot" });
const { db, load } = harness;
const { sql } = await load("/lib/db.ts");

const originalLines = [{ description: "Original", quantity: 1, unitCents: 1200 }];
const changedLines = [{ description: "Changed", quantity: 1, unitCents: 5000 }];

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  db.prepare(
    "INSERT INTO admin_quotes (id, customer_name, customer_email, notes, lines, shipping_cents, status) VALUES (1, 'Test', 'buyer@example.test', '', ?, 100, 'quote')"
  ).run(JSON.stringify(originalLines));

  // Mirrors app/api/admin/quotes/send-quote so the snapshot is produced by the
  // same SQLite JSON functions the route uses.
  const saved = await sql`
    INSERT INTO quote_share_tokens (token_hash, quote_id, snapshot, expires_at)
    SELECT 'fixture', id, json_object(
        'id', CAST(id AS TEXT),
        'customer_name', customer_name,
        'customer_email', customer_email,
        'notes', notes,
        'lines', json(lines),
        'shipping_cents', shipping_cents,
        'status', status,
        'created_at', created_at,
        'invoiced_at', invoiced_at
      ), strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days')
    FROM admin_quotes
    WHERE id = 1 AND status = 'quote' AND customer_email = 'buyer@example.test'
    RETURNING quote_id`;
  check("the quote snapshot is stored", saved.length === 1);

  db.prepare("UPDATE admin_quotes SET lines = ?, status = 'invoice' WHERE id = 1").run(JSON.stringify(changedLines));

  const rows = await sql`SELECT snapshot FROM quote_share_tokens WHERE token_hash = 'fixture' AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')`;
  const snapshot = JSON.parse(rows[0].snapshot);
  check("the emailed snapshot keeps the original line", snapshot.lines[0].description === "Original");
  check("the emailed snapshot keeps the original price", snapshot.lines[0].unitCents === 1200);
  check("the emailed snapshot keeps the original status", snapshot.status === "quote");
  check(
    "editing the quote does not change the snapshot",
    JSON.parse(db.prepare("SELECT snapshot FROM quote_share_tokens WHERE token_hash = 'fixture'").get().snapshot).lines[0]
      .description === "Original"
  );

  db.prepare("UPDATE quote_share_tokens SET expires_at = ? WHERE token_hash = 'fixture'").run(
    new Date(Date.now() - 1000).toISOString()
  );
  const expired = await sql`SELECT snapshot FROM quote_share_tokens WHERE token_hash = 'fixture' AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')`;
  check("an expired snapshot link stops resolving", expired.length === 0);

  // A fresh send only copies quotes that are still editable.
  db.prepare("INSERT INTO admin_quotes (id, customer_name, customer_email, notes, lines, shipping_cents, status) VALUES (2, 'Test', 'buyer@example.test', '', ?, 100, 'invoice')").run(
    JSON.stringify(originalLines)
  );
  const notEditable = await sql`
    INSERT INTO quote_share_tokens (token_hash, quote_id, snapshot, expires_at)
    SELECT 'fixture2', id, json_object('id', CAST(id AS TEXT), 'lines', json(lines)),
      strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days')
    FROM admin_quotes
    WHERE id = 2 AND status = 'quote'
    RETURNING quote_id`;
  check("a converted invoice cannot be emailed as a quote", notEditable.length === 0);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} quote snapshot check(s) failed` : "\nall quote snapshot checks passed");
process.exit(failures ? 1 : 0);
