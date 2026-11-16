/**
 * Exercises the order and inventory write paths against a local SQLite copy.
 * Run: node scripts/probe-order-writes.mjs
 */
import { createServer } from "vite";
import nodeAsyncHooks from "node:async_hooks";
import nodeModule from "node:module";
import nodeCrypto from "node:crypto";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// Vite's module runner loads source files without Node's builtin globals, so
// expose them before the app modules import.
for (const [key, value] of Object.entries({ ...nodeAsyncHooks, ...nodeModule, ...nodeCrypto, ...nodeFs, ...nodePath, ...nodeUrl })) {
  globalThis[key] ??= value;
}

const source = ".local-db/store.sqlite";
const target = ".local-db/orders-probe.sqlite";
if (!existsSync(source)) throw new Error(`Seed ${source} first (scripts/seed-sqlite.mjs)`);
rmSync(target, { force: true });
copyFileSync(source, target);

process.env.LOCAL_DB_PATH = target;

const db = new DatabaseSync(target);
db.exec("PRAGMA foreign_keys = ON;");
const variant = db.prepare(`
  SELECT p.id AS product_id, p.name AS product_name, p.slug, c.name AS color_name, c.hex AS color_hex, s.label AS size_label
  FROM products p
  JOIN product_colors c ON c.product_id = p.id
  JOIN product_sizes s ON s.product_id = p.id
  WHERE p.slug = 'crown-classic-tee'
  LIMIT 1`).get();
db.prepare("UPDATE inventory_control SET enabled = 1 WHERE id = 1").run();
db.prepare(`INSERT INTO inventory_stock (product_id, color_name, size_label, quantity)
            VALUES (?, ?, ?, 5)
            ON CONFLICT (product_id, color_name, size_label) DO UPDATE SET quantity = 5`)
  .run(variant.product_id, variant.color_name, variant.size_label);

const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});
const orders = await server.ssrLoadModule("/lib/orders.ts");
const inventory = await server.ssrLoadModule("/lib/inventory-reservations.ts");

const item = {
  productId: variant.product_id,
  productName: variant.product_name,
  productKind: "tee",
  saleMode: "customizable",
  colorName: variant.color_name,
  colorHex: variant.color_hex,
  unitPrice: 19.99,
  quantity: 2,
  total: 39.98,
  lines: [{ label: variant.size_label, qty: 2 }],
  design: { front: [], back: [] },
  previewFront: null,
  previewBack: null,
  roster: [],
  designNotes: "",
};

const buyer = {
  email: "qa@example.test",
  name: "QA Buyer",
  phone: "5550100",
  addressLine1: "1 Test Way",
  addressLine2: "",
  city: "Testville",
  region: "CA",
  postal: "90001",
  country: "US",
  notes: "",
  items: [item],
};

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

const attempt = "probe-attempt-1";
const created = await orders.createOrder({ ...buyer, checkoutAttemptId: attempt });
check("creates an order", /^KCP-/.test(created.reference) && created.reused === false);
check("totals are recomputed", created.subtotal === 39.98 && created.total === 46.93);

const again = await orders.createOrder({ ...buyer, checkoutAttemptId: attempt });
check("repeated attempt is reused", again.reference === created.reference && again.reused === true);

let conflict = false;
try {
  await orders.createOrder({ ...buyer, items: [{ ...item, quantity: 1, total: 19.99, lines: [{ label: variant.size_label, qty: 1 }] }], checkoutAttemptId: attempt });
} catch (error) {
  conflict = error?.name === "CheckoutAttemptConflictError" || error?.constructor?.name === "CheckoutAttemptConflictError";
}
check("changed payload on the same attempt is rejected", conflict);

const held = db.prepare("SELECT quantity FROM inventory_reservations WHERE order_id = (SELECT id FROM orders WHERE reference = ?)")
  .get(created.reference);
check("stock is held for the order", held?.quantity === 2);

let insufficient = false;
try {
  await orders.createOrder({ ...buyer, checkoutAttemptId: "probe-attempt-2", items: [{ ...item, quantity: 9, total: 179.91, lines: [{ label: variant.size_label, qty: 9 }] }] });
} catch (error) {
  console.log("   insufficient-stock error:", error?.name, "-", error?.message);
  insufficient = error?.constructor?.name === "InsufficientStockError" || /no longer available/.test(error?.message ?? "");
}
check("insufficient stock aborts the order", insufficient);
const leftover = db.prepare("SELECT count(*) AS n FROM orders WHERE checkout_attempt_id = 'probe-attempt-2'").get();
check("aborted order leaves no row", leftover.n === 0);

db.prepare("UPDATE orders SET stripe_session_id = ? WHERE reference = ?").run("cs_probe_1", created.reference);
const paid = await orders.markOrderPaid("cs_probe_1", "pi_probe_1", "evt_probe_1");
check("paid webhook returns the reference", paid?.reference === created.reference);
const paidAgain = await orders.markOrderPaid("cs_probe_1", "pi_probe_1", "evt_probe_1");
check("paid webhook is idempotent", paidAgain?.reference === created.reference);

const stock = db.prepare("SELECT quantity FROM inventory_stock WHERE product_id = ? AND color_name = ? AND size_label = ?")
  .get(variant.product_id, variant.color_name, variant.size_label);
check("payment consumes held stock", stock.quantity === 3);
const remainingHolds = db.prepare("SELECT count(*) AS n FROM inventory_reservations WHERE order_id = (SELECT id FROM orders WHERE reference = ?)")
  .get(created.reference);
check("holds are cleared after payment", remainingHolds.n === 0);
const status = db.prepare("SELECT status, paid_at FROM orders WHERE reference = ?").get(created.reference);
check("order is marked paid with a timestamp", status.status === "paid" && Boolean(status.paid_at));

const detail = await orders.getOrderByReference(created.reference);
check("order reads back with its line items", detail?.items.length === 1 && detail.items[0].quantity === 2);
check("order timestamps are ISO text", /^\d{4}-\d{2}-\d{2}T/.test(detail.createdAt));

// Cancelling an unpaid order releases its hold.
const second = await orders.createOrder({ ...buyer, checkoutAttemptId: "probe-attempt-3", items: [{ ...item, quantity: 1, total: 19.99, lines: [{ label: variant.size_label, qty: 1 }] }] });
db.prepare("UPDATE orders SET stripe_session_id = ? WHERE reference = ?").run("cs_probe_3", second.reference);
const cancelled = await orders.cancelOrder(second.reference, { stripeSessionId: "cs_probe_3", providerClosed: true });
check("expired checkout cancels the order", cancelled === true);
const released = db.prepare("SELECT count(*) AS n FROM inventory_reservations WHERE order_id = (SELECT id FROM orders WHERE reference = ?)")
  .get(second.reference);
check("cancelling releases the hold", released.n === 0);
const cancelState = db.prepare("SELECT status FROM orders WHERE reference = ?").get(second.reference);
check("order status is cancelled", cancelState.status === "cancelled");

// Admin transitions use compare-and-set.
const third = await orders.createOrder({ ...buyer, checkoutAttemptId: "probe-attempt-4", items: [{ ...item, quantity: 1, total: 19.99, lines: [{ label: variant.size_label, qty: 1 }] }] });
db.prepare("UPDATE orders SET stripe_session_id = ? WHERE reference = ?").run("cs_probe_4", third.reference);
await orders.markOrderPaid("cs_probe_4", "pi_probe_4", "evt_probe_4");
const advanced = await orders.updateOrderStatus(third.reference, "in_proof");
check("admin can advance a paid order", advanced.ok === true);
const skipped = await orders.updateOrderStatus(third.reference, "shipped");
check("invalid transitions are refused", skipped.ok === false && skipped.reason === "invalid-transition");

await server.close();
db.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall order write checks passed");
process.exit(failures ? 1 : 0);
