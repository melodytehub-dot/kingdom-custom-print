/**
 * Editing a product's colours and sizes must preserve counts, block removing
 * stocked or held options, and refuse stale counts that would come back.
 */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "product-inventory-edits" });
const { db, load, all } = harness;
const catalog = await load("/lib/catalog.ts");

const PRODUCT_ID = 99101;
db.prepare(
  "INSERT INTO products (id, slug, name, kind, base_price) VALUES (?, 'qa-fixture', 'Fixture', 'tee', 10)"
).run(PRODUCT_ID);
db.prepare("INSERT INTO product_colors (product_id, slug, name, hex) VALUES (?, 'black', 'Black', '#000000')").run(PRODUCT_ID);
db.prepare("INSERT INTO product_sizes (product_id, label) VALUES (?, 'M')").run(PRODUCT_ID);
db.prepare("INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (?, 'Black', 'M', 3)").run(PRODUCT_ID);

const input = {
  slug: "qa-fixture",
  name: "Fixture",
  styleCode: "",
  kind: "tee",
  saleMode: "ready-made",
  categoryId: null,
  blurb: "Changed",
  description: "",
  material: "",
  basePrice: 10,
  compareAt: null,
  printFeePerSide: 0,
  printArea: {},
  featured: false,
  active: true,
  colors: [
    {
      slug: "black",
      name: "Black",
      hex: "#000000",
      frontImage: "/api/product-media/00000000-0000-4000-8000-000000000001",
    },
  ],
  sizes: [{ label: "M", surcharge: 0 }],
  priceBreaks: [{ minQty: 1, amountOff: 0 }],
};
const renamed = { ...input, colors: [{ slug: "navy", name: "Navy", hex: "#000033" }] };

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};
const rejectsWith = async (label, pattern, fn) => {
  try {
    await fn();
    check(label, false);
  } catch (error) {
    check(label, pattern.test(error instanceof Error ? error.message : ""));
  }
};

try {
  check("a variant edit saves", (await catalog.updateProduct(PRODUCT_ID, input)) === true);
  check(
    "the product photo is stored",
    all("SELECT front_image FROM product_colors WHERE product_id = ?", PRODUCT_ID)[0]?.front_image === input.colors[0].frontImage
  );
  check(
    "the matching stock count is preserved",
    all("SELECT quantity FROM inventory_stock WHERE product_id = ?", PRODUCT_ID)[0]?.quantity === 3
  );

  await rejectsWith("removing a stocked colour is refused", /stock count to zero/, () =>
    catalog.updateProduct(PRODUCT_ID, renamed)
  );
  check(
    "the refused edit keeps the old colour",
    all("SELECT name FROM product_colors WHERE product_id = ?", PRODUCT_ID)[0]?.name === "Black"
  );

  db.prepare("UPDATE inventory_stock SET quantity = 0 WHERE product_id = ?").run(PRODUCT_ID);
  db.prepare("INSERT INTO orders (reference, email, name, status) VALUES ('KCP-QAPROD1', 'qa@example.test', 'QA', 'pending')").run();
  const orderId = db.prepare("SELECT id FROM orders WHERE reference = 'KCP-QAPROD1'").get().id;
  db.prepare(
    "INSERT INTO inventory_reservations (order_id, product_id, color_name, size_label, quantity) VALUES (?, ?, 'Black', 'M', 1)"
  ).run(orderId, PRODUCT_ID);

  await rejectsWith("removing a held colour is refused", /held for a pending order/, () =>
    catalog.updateProduct(PRODUCT_ID, renamed)
  );

  db.prepare("DELETE FROM inventory_reservations WHERE product_id = ?").run(PRODUCT_ID);
  check("the colour can change once the hold is gone", (await catalog.updateProduct(PRODUCT_ID, renamed)) === true);
  check(
    "the zero-count stock row for the removed colour is cleared",
    all("SELECT * FROM inventory_stock WHERE product_id = ?", PRODUCT_ID).length === 0
  );

  db.prepare("INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (?, 'Black', 'M', 5)").run(
    PRODUCT_ID
  );
  await rejectsWith("an old count cannot silently return", /old stock count/, () => catalog.updateProduct(PRODUCT_ID, input));
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} product inventory check(s) failed` : "\nall product inventory checks passed");
process.exit(failures ? 1 : 0);
