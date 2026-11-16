/** Duplicate checkout submissions must resolve to one order and one set of items. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createHarness, enableInventory } from "./qa-harness.mjs";

const harness = await createHarness({ name: "checkout-idempotency" });
const { db, load, all } = harness;
enableInventory(db, false);
const orders = await load("/lib/orders.ts");

const attempt = randomUUID();
const email = `qa-checkout-${Date.now()}@example.test`;

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
  items: [
    {
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
    },
  ],
};

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

const isConflict = (error) => error instanceof orders.CheckoutAttemptConflictError;

try {
  const first = await orders.createOrder(input);
  const retry = await orders.createOrder(input);
  check("the first attempt creates an order", first.reused === false);
  check("a repeated attempt reuses it", retry.reused === true && retry.reference === first.reference);

  const rejected = async (changes) => {
    try {
      await orders.createOrder({ ...input, ...changes });
      return false;
    } catch (error) {
      return isConflict(error);
    }
  };

  check("a changed address is rejected", await rejected({ addressLine1: "2 Different Street" }));
  check(
    "changed artwork instructions are rejected",
    await rejected({ items: [{ ...input.items[0], designNotes: "Changed artwork instructions" }] })
  );
  check(
    "a changed size breakdown is rejected",
    await rejected({ items: [{ ...input.items[0], lines: [{ label: "L", qty: 2 }] }] })
  );
  check(
    "changed design layers are rejected",
    await rejected({ items: [{ ...input.items[0], design: { front: [{ type: "text", text: "Different" }], back: [] } }] })
  );

  const counts = db
    .prepare(
      `SELECT count(DISTINCT o.id) AS orders, count(oi.id) AS items
       FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.checkout_attempt_id = ?`
    )
    .get(attempt);
  check("only one order row exists for the attempt", counts.orders === 1);
  check("only one set of line items exists", counts.items === 1);
  check("only one customer row exists", all("SELECT * FROM customers WHERE email = ?", email).length === 1);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} idempotency check(s) failed` : "\nall checkout idempotency checks passed");
process.exit(failures ? 1 : 0);
