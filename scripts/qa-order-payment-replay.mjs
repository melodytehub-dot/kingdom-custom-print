/**
 * Payment replay must preserve fulfilment, refunds must be recorded once, and
 * expiration must release a hold without touching on-hand stock.
 */
import assert from "node:assert/strict";
import { createHarness, enableInventory, seededVariant, setStock, stockCount } from "./qa-harness.mjs";

const harness = await createHarness({ name: "payment-replay" });
const { db, load, all } = harness;
const orders = await load("/lib/orders.ts");

const variant = seededVariant(db);
enableInventory(db, true);
setStock(db, variant, 2);

const stamp = Date.now().toString(36).toUpperCase();
const reference = `KCP-QA${stamp}`;
const session = `cs_test_qa_${Date.now()}`;

const insertOrder = (ref, extra = {}) => {
  const columns = ["reference", "email", "name", "status", ...Object.keys(extra)];
  const values = [ref, "qa-replay@example.com", "Temporary QA fixture", "pending", ...Object.values(extra)];
  const info = db
    .prepare(`INSERT INTO orders (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
    .run(...values);
  return Number(info.lastInsertRowid);
};
const hold = (orderId) =>
  db
    .prepare("INSERT INTO inventory_reservations (order_id, product_id, color_name, size_label, quantity) VALUES (?, ?, ?, ?, 1)")
    .run(orderId, variant.product_id, variant.color_name, variant.size_label);

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const orderId = insertOrder(reference, { stripe_session_id: session });
  hold(orderId);

  await orders.markOrderPaid(session, "pi_test_fixture");
  const paid = all("SELECT status, paid_at FROM orders WHERE reference = ?", reference)[0];
  check("the payment marks the order paid", paid.status === "paid" && Boolean(paid.paid_at));
  check("payment consumes the held unit", stockCount(db, variant) === 1);

  db.prepare("UPDATE orders SET status = 'shipped' WHERE reference = ?").run(reference);
  await orders.markOrderPaid(session, "pi_test_fixture");
  const replayed = all("SELECT status, paid_at FROM orders WHERE reference = ?", reference)[0];
  check("a replayed payment does not reopen a shipped order", replayed.status === "shipped");
  check("a replayed payment keeps the original paid time", replayed.paid_at === paid.paid_at);
  check("a replayed payment does not consume stock again", stockCount(db, variant) === 1);

  await orders.markOrderRefunded("pi_test_fixture", "evt_refund_fixture");
  const refunded = all("SELECT status, paid_at FROM orders WHERE reference = ?", reference)[0];
  check("a full refund is recorded", refunded.status === "refunded");
  check("a refund keeps the original paid time", refunded.paid_at === paid.paid_at);
  await orders.markOrderRefunded("pi_test_fixture", "evt_refund_fixture");
  const refundEvents = all("SELECT * FROM order_status_events WHERE to_status = 'refunded'");
  check("a replayed refund is recorded once", refundEvents.length === 1);

  const paypalId = `QA${Date.now()}`;
  const captureId = `${paypalId}C`;
  const paypalOrderId = insertOrder(`${reference}P`, { paypal_order_id: paypalId, total: 10 });
  hold(paypalOrderId);
  const captured = await orders.recordPayPalCapture(paypalId, captureId, "10.00", "USD");
  const capturedAgain = await orders.recordPayPalCapture(paypalId, captureId, "10.00", "USD");
  check("PayPal capture is accepted", captured?.reference === `${reference}P`);
  check("PayPal capture replay returns the same order", capturedAgain?.reference === `${reference}P`);
  check("PayPal capture and replay consume stock once", stockCount(db, variant) === 0);

  db.prepare("UPDATE inventory_stock SET quantity = 1").run();
  const expiredId = insertOrder(`${reference}E`);
  hold(expiredId);
  check("expiration cancels a pending order", (await orders.cancelOrder(`${reference}E`)) === true);
  check("a second expiration is a no-op", (await orders.cancelOrder(`${reference}E`)) === false);
  check("expiration releases the hold", all("SELECT * FROM inventory_reservations").length === 0);
  check("expiration leaves on-hand stock unchanged", stockCount(db, variant) === 1);

  const wrongAmount = await orders.recordPayPalCapture(paypalId, `${captureId}X`, "0.01", "USD");
  check("a mismatched PayPal amount is refused", wrongAmount === null);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} payment replay check(s) failed` : "\nall payment replay checks passed");
process.exit(failures ? 1 : 0);
