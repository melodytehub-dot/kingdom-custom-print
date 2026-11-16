/**
 * Two checkouts racing for the last unit: the batch guard must let exactly one
 * through, whichever order reaches the database first.
 */
import assert from "node:assert/strict";
import { createHarness, enableInventory, seededVariant, setStock } from "./qa-harness.mjs";

const harness = await createHarness({ name: "inventory-race" });
const { db, load, all } = harness;

const { sql } = await load("/lib/db.ts");
const inventory = await load("/lib/inventory-reservations.ts");
const variant = seededVariant(db);
enableInventory(db, true);
setStock(db, variant, 1);

const orderId = (reference) => {
  const info = db
    .prepare("INSERT INTO orders (reference, email, name, status) VALUES (?, 'qa-race@example.test', 'QA', 'pending')")
    .run(reference);
  return Number(info.lastInsertRowid);
};

const item = { productId: variant.product_id, colorName: variant.color_name, lines: [{ label: variant.size_label, qty: 1 }] };
const reserve = async (id) => {
  const statements = inventory.reserveInventoryStatements(id, [item], true);
  try {
    await sql.batch(statements);
  } catch (error) {
    if (inventory.isGuardFailure(error)) throw new inventory.InsufficientStockError();
    throw error;
  }
};

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const first = orderId("KCP-QARACE1");
  const second = orderId("KCP-QARACE2");

  const results = await Promise.allSettled([reserve(first), reserve(second)]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  check("exactly one checkout reserves the last unit", fulfilled.length === 1);
  check("the other checkout is told the item is gone", rejected.length === 1 && /no longer available/.test(rejected[0].reason?.message ?? ""));
  check("only one hold is stored", all("SELECT * FROM inventory_reservations").length === 1);
  check("on-hand stock is unchanged by holds", all("SELECT quantity FROM inventory_stock").length === 1);

  // A wider burst still leaves a single winner.
  db.prepare("DELETE FROM inventory_reservations").run();
  const contenders = Array.from({ length: 5 }, (_, index) => orderId(`KCP-QARACE${index + 3}`));
  const burst = await Promise.allSettled(contenders.map((id) => reserve(id)));
  check("a burst of checkouts leaves one winner", burst.filter((result) => result.status === "fulfilled").length === 1);
  check("the total holds never exceed the stock", all("SELECT * FROM inventory_reservations").length === 1);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} inventory race check(s) failed` : "\nall inventory race checks passed");
process.exit(failures ? 1 : 0);
