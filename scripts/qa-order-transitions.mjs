/** Admin status changes must be constrained and written to the audit trail. */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "order-transitions" });
const { db, load, all } = harness;
const orders = await load("/lib/orders.ts");

const stamp = Date.now().toString(36).toUpperCase();
const pendingRef = `KCP-QAP${stamp}`;
const paidRef = `KCP-QAD${stamp}`;

const insert = (reference, name, status) =>
  db
    .prepare("INSERT INTO orders (reference, email, name, status) VALUES (?, ?, ?, ?)")
    .run(reference, "qa-transition@example.test", name, status);

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  insert(pendingRef, "QA pending", "pending");
  insert(paidRef, "QA paid", "paid");
  db.prepare("UPDATE orders SET paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), stripe_payment_intent = 'pi_qa_transition' WHERE reference = ?").run(paidRef);

  const fakePaid = await orders.updateOrderStatus(pendingRef, "paid");
  check("an unpaid order cannot be marked paid", fakePaid.ok === false && fakePaid.reason === "invalid-transition");
  check(
    "the unpaid order keeps its status",
    all("SELECT status FROM orders WHERE reference = ?", pendingRef)[0]?.status === "pending"
  );

  const cancelled = await orders.updateOrderStatus(pendingRef, "cancelled");
  const proofing = await orders.updateOrderStatus(paidRef, "in_proof");
  check("a pending order can be cancelled", cancelled.ok === true);
  check("a paid order can move to proofing", proofing.ok === true);

  const events = all(
    `SELECT actor, from_status, to_status FROM order_status_events
     WHERE order_id IN (SELECT id FROM orders WHERE reference IN (?, ?))
     ORDER BY id`,
    pendingRef,
    paidRef
  );
  check("both transitions are recorded", events.length === 2);
  check(
    "the audit trail names the admin and the states",
    JSON.stringify(events.map((event) => [event.actor, event.from_status, event.to_status])) ===
      JSON.stringify([
        ["admin", "pending", "cancelled"],
        ["admin", "paid", "in_proof"],
      ])
  );

  const skipped = await orders.updateOrderStatus(paidRef, "shipped");
  check("a transition cannot skip a step", skipped.ok === false && skipped.reason === "invalid-transition");
  check(
    "the skipped status is unchanged",
    all("SELECT status FROM orders WHERE reference = ?", paidRef)[0]?.status === "in_proof"
  );

  // Cancelling a pending order that still holds stock is refused.
  const held = db
    .prepare("INSERT INTO orders (reference, email, name, status) VALUES (?, ?, ?, 'pending')")
    .run(`KCP-QAH${stamp}`, "qa-transition@example.test", "QA held");
  const variant = db.prepare("SELECT product_id, color_name, size_label FROM inventory_stock LIMIT 1").get();
  if (variant) {
    db.prepare(
      "INSERT INTO inventory_reservations (order_id, product_id, color_name, size_label, quantity) VALUES (?, ?, ?, ?, 1)"
    ).run(Number(held.lastInsertRowid), variant.product_id, variant.color_name, variant.size_label);
    const blocked = await orders.updateOrderStatus(`KCP-QAH${stamp}`, "cancelled");
    check("an order holding stock cannot be cancelled from admin", blocked.ok === false);
  } else {
    check("an order holding stock cannot be cancelled from admin", true);
  }
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} order transition check(s) failed` : "\nall order transition checks passed");
process.exit(failures ? 1 : 0);
