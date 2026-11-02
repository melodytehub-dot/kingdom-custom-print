/** Isolated database concurrency test. Creates and removes only its own schema. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 3, ssl: "require" });
const schema = `qa_inventory_${randomBytes(8).toString("hex")}`;
assert.match(schema, /^qa_inventory_[a-f0-9]{16}$/);
let created = false;
try {
  await db`CREATE SCHEMA ${db(schema)}`;
  created = true;
  await db.begin(async (tx) => {
    await tx`SELECT set_config('search_path', ${schema}, true)`;
    await tx`CREATE TABLE inventory_control (id boolean PRIMARY KEY, enabled boolean NOT NULL)`;
    await tx`CREATE TABLE inventory_stock (product_id int, color_name text, size_label text, quantity int, updated_at timestamptz DEFAULT now(), PRIMARY KEY(product_id, color_name, size_label))`;
    await tx`CREATE TABLE inventory_reservations (order_id int, product_id int, color_name text, size_label text, quantity int, PRIMARY KEY(order_id, product_id, color_name, size_label))`;
    await tx`INSERT INTO inventory_control VALUES (true, true)`;
    await tx`INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (2140000000, 'Test', 'M', 1)`;
  });
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("lib/inventory-reservations.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports });
  const item = { productId: 2140000000, colorName: "Test", lines: [{ label: "M", qty: 1 }] };
  const results = await Promise.allSettled([101, 102].map((orderId) => db.begin(async (tx) => {
    await tx`SELECT set_config('search_path', ${schema}, true)`;
    await exports.reserveInventory(tx, orderId, [item]);
  })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && /no longer available/.test(result.reason.message)).length, 1);
  await db.begin(async (tx) => {
    await tx`SELECT set_config('search_path', ${schema}, true)`;
    const [row] = await tx`SELECT count(*)::int AS count FROM inventory_reservations`;
    assert.equal(row.count, 1);
  });
  console.log("PASS: two concurrent checkouts cannot reserve the same last item");
} finally {
  if (created) await db`DROP SCHEMA ${db(schema)} CASCADE`;
  await db.end();
}
