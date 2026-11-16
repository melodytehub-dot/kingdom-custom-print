/**
 * Order creation, retries, out-of-stock rejection and payment confirmation
 * against a disposable seeded SQLite database.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createHarness, enableInventory, seededVariant, setStock, stockCount } from "./qa-harness.mjs";

const harness = await createHarness({ name: "stock-checkout" });
const { db, load, all } = harness;
const orders = await load("/lib/orders.ts");

const variant = seededVariant(db);
enableInventory(db, true);
setStock(db, variant, 1);

const input = {
  checkoutAttemptId: randomUUID(),
  accountId: null,
  email: "stock-qa@example.test",
  name: "Temporary stock test",
  phone: "",
  addressLine1: "1 Test Road",
  addressLine2: "",
  city: "Test",
  region: "IN",
  postal: "00000",
  country: "US",
  notes: "",
  items: [
    {
      productId: variant.product_id,
      productName: variant.product_name,
      productKind: variant.kind,
      colorName: variant.color_name,
      colorHex: variant.color_hex,
      unitPrice: 10,
      total: 10,
      quantity: 1,
      lines: [{ label: variant.size_label, qty: 1 }],
      design: { front: [], back: [] },
      previewFront: null,
      previewBack: null,
      designNotes: "",
    },
  ],
};

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const first = await orders.createOrder(input);
  const retry = await orders.createOrder(input);
  check("a checkout retry reuses the same order", retry.reference === first.reference && retry.reused === true);
  check("one stock hold is made for the order", all("SELECT * FROM inventory_reservations").length === 1);

  let soldOut = false;
  try {
    await orders.createOrder({ ...input, checkoutAttemptId: randomUUID() });
  } catch (error) {
    soldOut = /no longer available/.test(error instanceof Error ? error.message : "");
  }
  check("the last unit cannot be sold twice", soldOut);

  const session = `cs_test_stock_${Date.now()}`;
  await orders.attachStripeSession(first.reference, session);
  await orders.markOrderPaid(session, `pi_test_stock_${Date.now()}`);
  await orders.markOrderPaid(session, `pi_test_stock_${Date.now()}`);
  check("payment consumes the held unit exactly once", stockCount(db, variant) === 0);
  check("holds are cleared after payment", all("SELECT * FROM inventory_reservations").length === 0);
  check(
    "the order is marked paid with one audit event",
    all("SELECT * FROM orders WHERE reference = ?", first.reference)[0]?.status === "paid" &&
      all("SELECT * FROM order_status_events WHERE to_status = 'paid'").length === 1
  );
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} stock checkout check(s) failed` : "\nall stock checkout checks passed");
process.exit(failures ? 1 : 0);
