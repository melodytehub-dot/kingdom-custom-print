/** Full order/reservation integration in a transaction that is always rolled back. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";
import { randomUUID, webcrypto } from "node:crypto";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback fixture");
const compile = (file, deps = {}) => {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, crypto: webcrypto, require: (name) => deps[name] });
  return exports;
};
try {
  await db.begin(async (tx) => {
    await tx`CREATE TEMP TABLE inventory_control (id boolean PRIMARY KEY, enabled boolean NOT NULL) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE inventory_stock (product_id int, color_name text, size_label text, quantity int, updated_at timestamptz DEFAULT now(), PRIMARY KEY(product_id, color_name, size_label)) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE inventory_reservations (order_id int, product_id int, color_name text, size_label text, quantity int, PRIMARY KEY(order_id, product_id, color_name, size_label)) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE inventory_adjustments (product_id int, product_name text, color_name text, size_label text, previous_quantity int, new_quantity int) ON COMMIT DROP`;
    await tx`INSERT INTO inventory_control VALUES (true, true)`;
    const [variant] = await tx`SELECT p.id, p.name, p.kind, c.name AS color, c.hex, s.label AS size FROM products p JOIN product_colors c ON c.product_id = p.id JOIN product_sizes s ON s.product_id = p.id WHERE p.active = true LIMIT 1`;
    assert.ok(variant);
    await tx`INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (${variant.id}, ${variant.color}, ${variant.size}, 1)`;
    const sql = new Proxy(tx, { get(target, property) { return property === "begin" ? (fn) => tx.savepoint(fn) : Reflect.get(target, property); } });
    const inventory = compile("lib/inventory-reservations.ts");
    const orders = compile("lib/orders.ts", { "./db": { sql, num: Number }, "./catalog": { getSettings: async () => ({ shippingFlat: 0, freeShippingThreshold: 0 }) }, "./pricing": { round2: (value) => Math.round(value * 100) / 100 }, "./types": { ADMIN_ORDER_TRANSITIONS: {} }, "./inventory-reservations": inventory });
    const attempt = randomUUID();
    const input = { checkoutAttemptId: attempt, accountId: null, email: "stock-qa@example.test", name: "Temporary stock test", phone: "", addressLine1: "1 Test Road", addressLine2: "", city: "Test", region: "IN", postal: "00000", country: "US", notes: "", items: [{ productId: variant.id, productName: variant.name, productKind: variant.kind, colorName: variant.color, colorHex: variant.hex, unitPrice: 10, total: 10, quantity: 1, lines: [{ label: variant.size, qty: 1 }], design: { front: [], back: [] }, previewFront: null, previewBack: null, designNotes: "" }] };
    const first = await orders.createOrder(input);
    const retry = await orders.createOrder(input);
    assert.equal(retry.reference, first.reference);
    assert.equal((await tx`SELECT count(*)::int AS count FROM inventory_reservations`)[0].count, 1);
    await assert.rejects(orders.createOrder({ ...input, checkoutAttemptId: randomUUID() }), /no longer available/);
    const session = `cs_test_stock_${Date.now()}`;
    await orders.attachStripeSession(first.reference, session);
    await orders.markOrderPaid(session, `pi_test_stock_${Date.now()}`);
    await orders.markOrderPaid(session, `pi_test_stock_${Date.now()}`);
    assert.equal((await tx`SELECT quantity FROM inventory_stock`)[0].quantity, 0);
    assert.equal((await tx`SELECT count(*)::int AS count FROM inventory_reservations`)[0].count, 0);
    console.log("PASS: order retries, out-of-stock rejection, and payment confirmation are atomic");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
