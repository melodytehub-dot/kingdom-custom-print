/** Database integration check for duplicate checkout submissions. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("Run with --env-file=.env.local");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const attempt = crypto.randomUUID();
const email = `qa-checkout-${stamp}@example.test`;

try {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync("lib/orders.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const deps = {
    "./db": { sql, num: Number },
    "./catalog": { getSettings: async () => ({ shippingFlat: 6.95, freeShippingThreshold: 75 }) },
    "./pricing": { round2: value => Math.round((value + Number.EPSILON) * 100) / 100 },
    "./types": { ADMIN_ORDER_TRANSITIONS: {} },
  };
  vm.runInNewContext(source, { exports, require: name => deps[name], crypto });

  const input = {
    checkoutAttemptId: attempt,
    accountId: null,
    email,
    name: "QA Checkout Retry",
    phone: "",
    addressLine1: "1 QA Lane",
    addressLine2: "",
    city: "Austin",
    region: "TX",
    postal: "78701",
    country: "US",
    notes: "",
    items: [{
      productId: null,
      productName: "QA Tee",
      productKind: "tee",
      colorName: "Black",
      colorHex: "#111111",
      unitPrice: 20,
      total: 40,
      quantity: 2,
      lines: [{ label: "M", qty: 2 }],
      design: { front: [], back: [] },
      previewFront: null,
      previewBack: null,
      designNotes: "",
    }],
  };

  const first = await exports.createOrder(input);
  const retry = await exports.createOrder(input);
  assert.equal(first.reused, false);
  assert.equal(retry.reused, true);
  assert.equal(retry.reference, first.reference);
  const [counts] = await sql`
    SELECT count(DISTINCT o.id)::int AS orders, count(oi.id)::int AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.checkout_attempt_id = ${attempt}`;
  assert.equal(counts.orders, 1);
  assert.equal(counts.items, 1);
  console.log("PASS a repeated checkout attempt reuses one order and one set of line items");
} finally {
  await sql`DELETE FROM orders WHERE checkout_attempt_id = ${attempt}`;
  await sql`DELETE FROM customers WHERE email = ${email}`;
  await sql.end();
}
