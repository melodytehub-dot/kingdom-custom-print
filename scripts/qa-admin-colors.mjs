import { request } from "playwright";
import postgres from "postgres";
const api = await request.newContext({ baseURL: process.env.QA_BASE ?? "http://localhost:3005" });
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
let id;
let categoryId;
try {
  const login = await api.post("/api/admin/login", { data: { password: "LocalTestingOnly2026" } });
  if (!login.ok()) throw new Error("Test admin sign-in failed");
  const colors = Array.from({ length: 32 }, (_, index) => ({ slug: `color-${index}`, name: `Color ${index}`, hex: "#112233" }));
  const suffix = Date.now();
  const product = { name: `QA temporary colors ${suffix}`, kind: "tee", basePrice: 10, colors, sizes: [{ label: "M", surcharge: 0 }], priceBreaks: [{ minQty: 1, amountOff: 0 }], active: false };
  const created = await api.post("/api/admin/products", { data: product });
  if (!created.ok()) throw new Error(`Create failed: ${created.status()}`);
  id = (await created.json()).id;
  const updated = await api.put("/api/admin/products", { data: { ...product, id } });
  if (!updated.ok()) throw new Error(`Update failed: ${updated.status()}`);
  const [stored] = await db`select count(*)::int as n from product_colors where product_id=${id}`;
  if (stored.n !== 32) throw new Error(`Expected 32 saved colors, got ${stored.n}`);
  const [savedProduct] = await db`select slug from products where id=${id}`;
  if (savedProduct.slug !== `qa-temporary-colors-${suffix}`) throw new Error("Product link was not generated from its name");
  const category = await api.post("/api/admin/categories", { data: { name: `QA category ${suffix}`, description: "Temporary QA", sortOrder: 999 } });
  if (!category.ok()) throw new Error(`Category create failed: ${category.status()}`);
  categoryId = (await category.json()).id;
  const [savedCategory] = await db`select slug from categories where id=${categoryId}`;
  if (savedCategory.slug !== `qa-category-${suffix}`) throw new Error("Category link was not generated from its name");
  const duplicate = await api.put("/api/admin/products", { data: { ...product, id, colors: [colors[0], colors[0]] } });
  if (duplicate.status() !== 422) throw new Error(`Duplicate color returned ${duplicate.status()}`);
  console.log("PASS products with 32 colors save, duplicate colors are rejected, and product/category links come from names");
} finally {
  if (id) await api.delete(`/api/admin/products?id=${id}`);
  if (categoryId) await api.delete(`/api/admin/categories?id=${categoryId}`);
  await api.post("/api/admin/logout");
  await api.dispose();
  await db.end();
}
