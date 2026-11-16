/**
 * A product photo, a finished-goods product, availability and checkout work
 * together: uploads round-trip, stock is held, retries reuse the order, and the
 * last units cannot be sold twice.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createHarness, enableInventory } from "./qa-harness.mjs";

process.env.ADMIN_PASSWORD ??= "localtestpassword123";
const harness = await createHarness({ name: "commerce" });
const { db, load, all } = harness;

const auth = await load("/lib/admin-auth.ts");
const upload = await load("/app/api/admin/product-media/route.ts");
const media = await load("/app/api/product-media/[id]/route.ts");
const products = await load("/app/api/admin/products/route.ts");
const catalog = await load("/lib/catalog.ts");
const availability = await load("/app/api/products/[id]/availability/route.ts");
const orders = await load("/lib/orders.ts");

const token = await auth.createSession();
const headers = { cookie: `kcp_admin=${token}`, origin: "https://example.test" };

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  enableInventory(db, true);
  const bytes = [255, 216, 255, 0];
  const form = new FormData();
  form.set("image", new File([new Uint8Array(bytes)], "test.jpg", { type: "image/jpeg" }));
  const uploaded = await upload.POST(
    new Request("https://example.test/api/admin/product-media", { method: "POST", headers, body: form })
  );
  check("a product photo uploads", uploaded.status === 200);
  const { url } = await uploaded.json();
  check("the upload returns a media URL", /^\/api\/product-media\/[0-9a-f-]{36}$/.test(url ?? ""));

  const payload = {
    name: "Temporary finished product",
    kind: "other",
    saleMode: "ready-made",
    active: true,
    basePrice: 21,
    colors: [{ slug: "black", name: "Black", hex: "#111111", frontImage: url }],
    sizes: [{ label: "One size", surcharge: 0 }],
    priceBreaks: [],
  };
  const created = await products.POST(
    new Request("https://example.test/api/admin/products", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  check("a finished-goods product is created", created.status === 200, await created.clone().text());
  const { id } = await created.json();

  const product = await catalog.getProductById(id);
  check("the product is sold as finished goods", product.saleMode === "ready-made");
  check("the product photo is linked", product.colors[0].frontImage === url);
  check("the price is stored", product.basePrice === 21);

  const fetched = await media.GET(new Request(`https://example.test${url}`), {
    params: Promise.resolve({ id: url.split("/").pop() }),
  });
  check("the product photo is served", fetched.status === 200);
  check("the photo keeps its format", fetched.headers.get("content-type") === "image/jpeg");
  check(
    "the photo bytes round-trip",
    JSON.stringify([...new Uint8Array(await fetched.arrayBuffer())]) === JSON.stringify(bytes)
  );

  db.prepare("INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (?, 'Black', 'One size', 2)").run(id);

  const item = {
    productId: id,
    productName: product.name,
    productKind: product.kind,
    saleMode: "ready-made",
    colorName: "Black",
    colorHex: "#111111",
    unitPrice: 21,
    total: 42,
    quantity: 2,
    lines: [{ label: "One size", qty: 2 }],
    design: { front: [], back: [] },
    previewFront: url,
    previewBack: null,
    designNotes: "",
  };
  const checkout = {
    checkoutAttemptId: randomUUID(),
    accountId: null,
    email: "qa@example.test",
    name: "Test",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postal: "",
    country: "US",
    notes: "",
    items: [item],
  };

  const first = await orders.createOrder(checkout);
  const retry = await orders.createOrder(checkout);
  check("a checkout retry reuses the order", retry.reference === first.reference && retry.reused === true);

  const response = await availability.GET(new Request("https://example.test/availability"), {
    params: Promise.resolve({ id: String(id) }),
  });
  const availabilityBody = await response.json();
  check("availability shows no free stock once held", availabilityBody.options[0]?.available === 0);

  let soldOut = false;
  try {
    await orders.createOrder({ ...checkout, checkoutAttemptId: randomUUID() });
  } catch (error) {
    soldOut = /no longer available/.test(error instanceof Error ? error.message : "");
  }
  check("the held units cannot be sold again", soldOut);
  check("one stock hold exists", all("SELECT * FROM inventory_reservations").length === 1);
  check("one order exists", all("SELECT * FROM orders").length === 1);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} commerce check(s) failed` : "\nall commerce checks passed");
process.exit(failures ? 1 : 0);
