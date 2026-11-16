/**
 * Inventory permissions, conflict handling, stock holds and payment replay.
 * Runs against a disposable seeded SQLite database and the real admin route.
 */
import assert from "node:assert/strict";
import { createHarness, seededVariant, setStock, stockCount } from "./qa-harness.mjs";

process.env.ADMIN_PASSWORD ??= "localtestpassword123";
const harness = await createHarness({ name: "inventory" });
const { db, load, one, all, run } = harness;

const { sql } = await load("/lib/db.ts");
const inventory = await load("/lib/inventory-reservations.ts");
const auth = await load("/lib/admin-auth.ts");
const route = await load("/app/api/admin/inventory/route.ts");

const token = await auth.createSession();
const call = (method, body, query = "") =>
  route[method](
    new Request(`https://example.test/api/admin/inventory${query}`, {
      method,
      headers: { cookie: `kcp_admin=${token}`, origin: "https://example.test", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  );

const insertOrder = (status = "pending") => {
  const info = db
    .prepare("INSERT INTO orders (reference, email, name, status) VALUES (?, ?, ?, ?)")
    .run(`KCP-QA${Math.random().toString(36).slice(2, 9).toUpperCase()}`, "qa-inventory@example.test", "QA", status);
  return Number(info.lastInsertRowid);
};

const reserve = async (orderId, items, enabled) => {
  const statements = inventory.reserveInventoryStatements(orderId, items, enabled);
  if (!statements.length) return;
  try {
    await sql.batch(statements);
  } catch (error) {
    if (inventory.isGuardFailure(error)) throw new inventory.InsufficientStockError();
    throw error;
  }
};
const consume = async (orderId) => {
  const statements = await inventory.consumeInventoryStatements(orderId);
  if (statements.length) await sql.batch(statements);
};
const release = async (orderId) => {
  const statements = await inventory.releaseInventoryStatements(orderId);
  if (statements.length) await sql.batch(statements);
};

const variant = seededVariant(db);
const payload = { productId: variant.product_id, counts: [{ color: variant.color_name, size: variant.size_label, quantity: 7, expected: null }] };
const item = { productId: variant.product_id, colorName: variant.color_name, lines: [{ label: variant.size_label, qty: 2 }] };

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  // Permissions and protection toggle.
  const anonymous = await route.PUT(
    new Request("https://example.test/api/admin/inventory", {
      method: "PUT",
      headers: { origin: "https://example.test", "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  check("anonymous inventory writes are rejected", anonymous.status === 401);
  check("protection can be enabled with unknown counts", (await call("PATCH", { enabled: true })).status === 200);
  check("protection can be disabled", (await call("PATCH", { enabled: false })).status === 200);
  check("counts save", (await call("PUT", payload)).status === 200);
  check("a stale expected count is refused", (await call("PUT", payload)).status === 409);
  check(
    "negative counts are refused",
    (await call("PUT", { ...payload, counts: [{ ...payload.counts[0], quantity: -1 }] })).status === 422
  );
  check(
    "a matching expected count updates the count",
    (await call("PUT", { ...payload, counts: [{ ...payload.counts[0], expected: 7, quantity: 0 }] })).status === 200
  );

  const listed = await call("GET", undefined, `?product=${variant.product_id}`);
  const listing = await listed.json();
  check("inventory listing shows the saved count", listing.counts[0]?.quantity === 0);
  check("inventory listing shows both adjustments", listing.history.length === 2);
  check("on-hand stock follows the count", stockCount(db, variant) === 0);

  // Blank garments: unknown stock cannot be ordered while protection is on.
  check("protection re-enabled", (await call("PATCH", { enabled: true })).status === 200);
  await assert.rejects(() => reserve(insertOrder(), [item], true), /no longer available/);
  check("unknown stock cannot be reserved", true);

  check("protection disabled for the next checks", (await call("PATCH", { enabled: false })).status === 200);
  setStock(db, variant, 0);
  check("disabled protection skips blank-garment holds", (await reserve(insertOrder(), [item], false)) === undefined);
  check("customizable blanks are not held while protection is off", all("SELECT * FROM inventory_reservations").length === 0);

  check(
    "a zero count can be raised",
    (await call("PUT", { ...payload, counts: [{ ...payload.counts[0], expected: 0, quantity: 3 }] })).status === 200
  );

  const readyMade = insertOrder();
  await reserve(readyMade, [{ ...item, saleMode: "ready-made" }], false);
  check("finished goods reserve stock even when protection is off", all("SELECT * FROM inventory_reservations WHERE order_id = ?", readyMade).length === 1);
  await assert.rejects(() => reserve(insertOrder(), [{ ...item, saleMode: "ready-made" }], false), /no longer available/);
  check("finished goods still cannot oversell", true);
  await release(readyMade);
  check("releasing a hold removes it", all("SELECT * FROM inventory_reservations WHERE order_id = ?", readyMade).length === 0);

  // Pending payment sessions block activation.
  insertOrder("pending");
  check("pending orders block activation", (await call("PATCH", { enabled: true })).status === 409);
  run("DELETE FROM orders");
  check("activation works once pending orders are cleared", (await call("PATCH", { enabled: true })).status === 200);

  const heldOrder = insertOrder();
  await reserve(heldOrder, [item], true);
  await assert.rejects(() => reserve(insertOrder(), [item], true), /no longer available/);
  check("two orders cannot hold the same last units", all("SELECT * FROM inventory_reservations").length === 1);
  check("held stock blocks disabling protection", (await call("PATCH", { enabled: false })).status === 409);
  check(
    "a count cannot drop below the held quantity",
    (await call("PUT", { ...payload, counts: [{ ...payload.counts[0], expected: 3, quantity: 1 }] })).status === 409
  );

  await consume(heldOrder);
  await consume(heldOrder);
  check("payment replay does not consume twice", stockCount(db, variant) === 1);

  const releaseOrder = insertOrder();
  await reserve(releaseOrder, [{ ...item, lines: [{ label: variant.size_label, qty: 1 }] }], true);
  await release(releaseOrder);
  await release(releaseOrder);
  check("release is idempotent", all("SELECT * FROM inventory_reservations").length === 0);
  check("release does not change on-hand stock", stockCount(db, variant) === 1);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} inventory check(s) failed` : "\nall inventory checks passed");
process.exit(failures ? 1 : 0);
