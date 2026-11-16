/**
 * Products with many colours save in one go, duplicate colours are refused, and
 * product/category links are generated from their names.
 */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

process.env.ADMIN_PASSWORD ??= "localtestpassword123";
const harness = await createHarness({ name: "admin-colors" });
const { db, load } = harness;

const auth = await load("/lib/admin-auth.ts");
const products = await load("/app/api/admin/products/route.ts");
const categories = await load("/app/api/admin/categories/route.ts");
const token = await auth.createSession();

const call = (route, method, body) =>
  route[method](
    new Request("https://example.test/api/admin", {
      method,
      headers: { cookie: `kcp_admin=${token}`, origin: "https://example.test", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  );

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const colors = Array.from({ length: 32 }, (_, index) => ({ slug: `color-${index}`, name: `Color ${index}`, hex: "#112233" }));
  const suffix = Date.now();
  const product = {
    name: `QA temporary colors ${suffix}`,
    kind: "tee",
    basePrice: 10,
    colors,
    sizes: [{ label: "M", surcharge: 0 }],
    priceBreaks: [{ minQty: 1, amountOff: 0 }],
    active: false,
  };

  const created = await call(products, "POST", product);
  const createdBody = await created.json();
  check("a product with 32 colours is created", created.status === 200, JSON.stringify(createdBody));
  const id = createdBody.id;

  const updated = await call(products, "PUT", { ...product, id });
  check("the product saves with all 32 colours", updated.status === 200);

  check("all 32 colours are stored", db.prepare("SELECT count(*) AS n FROM product_colors WHERE product_id = ?").get(id).n === 32);
  check(
    "the product link is generated from its name",
    db.prepare("SELECT slug FROM products WHERE id = ?").get(id).slug === `qa-temporary-colors-${suffix}`
  );

  const category = await call(categories, "POST", { name: `QA category ${suffix}`, description: "Temporary QA", sortOrder: 999 });
  const categoryBody = await category.json();
  check("a category is created", category.status === 200, JSON.stringify(categoryBody));
  check(
    "the category link is generated from its name",
    db.prepare("SELECT slug FROM categories WHERE id = ?").get(categoryBody.id).slug === `qa-category-${suffix}`
  );

  const duplicate = await call(products, "PUT", { ...product, id, colors: [colors[0], colors[0]] });
  check("duplicate colours are refused", duplicate.status === 422);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} admin colour check(s) failed` : "\nall admin colour checks passed");
process.exit(failures ? 1 : 0);
