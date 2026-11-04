/** Isolated temporary tables; every write is rolled back. No orders or payments. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";
import { NextResponse } from "next/server.js";
import { randomUUID, webcrypto } from "node:crypto";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback test fixture");
function load(file, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const out = {};
  vm.runInNewContext(code, { exports: out, require: name => { if (!(name in deps)) throw new Error(`Missing dependency: ${name}`); return deps[name]; }, Request, Response, Headers, Blob, File, FormData, Uint8Array, Buffer, RangeError, crypto: webcrypto, console });
  return out;
}
try {
  await db.begin(async tx => {
    await tx`CREATE TEMP TABLE categories (id serial PRIMARY KEY, slug text, name text) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE products (id serial PRIMARY KEY, slug text, name text, style_code text, kind text, sale_mode text, category_id int, blurb text, description text, material text, base_price numeric, compare_at numeric, print_fee_per_side numeric, print_area jsonb, featured boolean, active boolean, sort_order int DEFAULT 0) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE product_colors (id serial PRIMARY KEY, product_id int, slug text, name text, hex text, sort_order int, front_image text, back_image text) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE product_sizes (id serial PRIMARY KEY, product_id int, label text, surcharge numeric, sort_order int) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE price_breaks (product_id int, min_qty int, amount_off numeric) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE product_images (id serial PRIMARY KEY, product_id int, url text, alt text, sort_order int) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE catalog_media (id text PRIMARY KEY, content_type text, content bytea) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE inventory_control (id boolean PRIMARY KEY, enabled boolean) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE inventory_stock (product_id int, color_name text, size_label text, quantity int, updated_at timestamptz DEFAULT now(), PRIMARY KEY(product_id,color_name,size_label)) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE inventory_reservations (order_id int, product_id int, color_name text, size_label text, quantity int, PRIMARY KEY(order_id,product_id,color_name,size_label)) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE customers (id serial PRIMARY KEY, email text UNIQUE, name text, phone text) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE orders (id serial PRIMARY KEY, reference text, customer_id int, account_id int, email text, name text, phone text, address_line1 text, address_line2 text, city text, region text, postal text, country text, notes text, status text, subtotal numeric, shipping numeric, total numeric, checkout_attempt_id text) ON COMMIT DROP`;
    await tx`CREATE UNIQUE INDEX ON orders (checkout_attempt_id) WHERE checkout_attempt_id IS NOT NULL`;
    await tx`CREATE TEMP TABLE order_items (id serial PRIMARY KEY, order_id int, product_id int, product_name text, product_kind text, sale_mode text, color_name text, color_hex text, unit_price numeric, quantity int, size_breakdown jsonb, design jsonb, preview_front text, preview_back text, roster jsonb, notes text) ON COMMIT DROP`;
    await tx`INSERT INTO inventory_control VALUES (true, false)`;
    await tx`SELECT setval(pg_get_serial_sequence('products', 'id'), 1900000000, false)`;
    const sql = new Proxy(tx, { get(target, key) { return key === "begin" ? fn => tx.savepoint(fn) : Reflect.get(target, key); } });
    const guard = { requireAdmin: async () => null };
    const formats = load("lib/imageFormat.ts");
    const limits = load("lib/limited-form-data.ts");
    const upload = load("app/api/admin/product-media/route.ts", { "node:crypto": { randomUUID }, "next/server": { NextResponse }, "../_guard": guard, "@/lib/db": { sql }, "@/lib/imageFormat": formats, "@/lib/limited-form-data": limits });
    const data = new FormData(); data.set("image", new File([new Uint8Array([255,216,255,0])], "test.jpg", { type: "image/jpeg" }));
    const uploaded = await upload.POST(new Request("https://example.test/api/admin/product-media", { method: "POST", body: data }));
    assert.equal(uploaded.status, 200);
    const { url } = await uploaded.json();
    const catalog = load("lib/catalog.ts", { postgres: { default: {} }, "./db": { sql, num: Number } });
    const route = load("app/api/admin/products/route.ts", { "next/server": { NextResponse }, "next/cache": { revalidatePath() {} }, "../_guard": guard, "@/lib/catalog": catalog, "@/lib/db": { sql } });
    const payload = { name: "Temporary finished product", kind: "other", saleMode: "ready-made", active: true, basePrice: 21, colors: [{ slug: "black", name: "Black", hex: "#111111", frontImage: url }], sizes: [{ label: "One size", surcharge: 0 }], priceBreaks: [] };
    const created = await route.POST(new Request("https://example.test/api/admin/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }));
    assert.equal(created.status, 200);
    const { id } = await created.json();
    const product = await catalog.getProductById(id);
    assert.equal(product.saleMode, "ready-made");
    assert.equal(product.colors[0].frontImage, url);
    assert.equal(product.basePrice, 21);
    const media = load("app/api/product-media/[id]/route.ts", { "@/lib/db": { sql } });
    const fetched = await media.GET(new Request(`https://example.test${url}`), { params: Promise.resolve({ id: url.split("/").pop() }) });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.headers.get("content-type"), "image/jpeg");
    assert.deepEqual([...new Uint8Array(await fetched.arrayBuffer())], [255,216,255,0]);
    await tx`INSERT INTO inventory_stock (product_id,color_name,size_label,quantity) VALUES (${id}, 'Black', 'One size', 2)`;
    const inventory = load("lib/inventory-reservations.ts");
    const item = { productId: id, colorName: "Black", saleMode: "ready-made", lines: [{ label: "One size", qty: 2 }] };
    const orders = load("lib/orders.ts", { "./db": { sql, num: Number }, "./catalog": { getSettings: async () => ({ shippingFlat: 0, freeShippingThreshold: 0 }) }, "./pricing": { round2: n => Math.round(n * 100) / 100 }, "./types": { ADMIN_ORDER_TRANSITIONS: {} }, "./inventory-reservations": inventory });
    const cartItem = { ...item, productName: product.name, productKind: product.kind, colorHex: "#111111", unitPrice: 21, total: 42, quantity: 2, design: { front: [], back: [] }, previewFront: url, previewBack: null };
    const checkout = { checkoutAttemptId: randomUUID(), accountId: null, email: "qa@example.test", name: "Test", phone: "", addressLine1: "", addressLine2: "", city: "", region: "", postal: "", country: "US", notes: "", items: [cartItem] };
    const first = await orders.createOrder(checkout);
    const retry = await orders.createOrder(checkout);
    assert.equal(retry.reference, first.reference);
    assert.equal(retry.reused, true);
    const availability = load("app/api/products/[id]/availability/route.ts", { "next/server": { NextResponse }, "@/lib/db": { sql } });
    const response = await availability.GET(new Request("https://example.test/availability"), { params: Promise.resolve({ id: String(id) }) });
    assert.equal((await response.json()).options[0].available, 0);
    await assert.rejects(orders.createOrder({ ...checkout, checkoutAttemptId: randomUUID() }), /no longer available/);
    console.log("PASS: product photos, catalog, availability, checkout retries and stock holds work together");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
