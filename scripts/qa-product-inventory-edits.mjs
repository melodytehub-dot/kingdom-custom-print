import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback fixture");
try {
  await db.begin(async tx => {
    for (const table of ["products", "product_colors", "product_sizes", "price_breaks", "inventory_stock", "inventory_reservations"]) {
      await tx.unsafe(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS) ON COMMIT DROP`);
    }
    await tx`INSERT INTO products (id, slug, name, kind, base_price) VALUES (99101, 'qa-fixture', 'Fixture', 'tee', 10)`;
    await tx`INSERT INTO product_colors (product_id, slug, name, hex) VALUES (99101, 'black', 'Black', '#000000')`;
    await tx`INSERT INTO product_sizes (product_id, label) VALUES (99101, 'M')`;
    await tx`INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (99101, 'Black', 'M', 3)`;
    const sql = new Proxy(tx, { get(target, key) { return key === 'begin' ? fn => tx.savepoint(fn) : Reflect.get(target, key); } });
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync('lib/catalog.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(source, { exports, require: name => name === './db' ? { sql, num: Number } : name === 'postgres' ? { default: {} } : {} });
    const input = { slug: 'qa-fixture', name: 'Fixture', styleCode: '', kind: 'tee', categoryId: null, blurb: 'Changed', description: '', material: '', basePrice: 10, compareAt: null, printFeePerSide: 0, printArea: {}, featured: false, active: true, colors: [{ slug: 'black', name: 'Black', hex: '#000000' }], sizes: [{ label: 'M', surcharge: 0 }], priceBreaks: [{ minQty: 1, amountOff: 0 }] };
    assert.equal(await exports.updateProduct(99101, input), true);
    assert.equal((await tx`SELECT quantity FROM inventory_stock WHERE product_id = 99101`)[0].quantity, 3);
    const renamed = { ...input, colors: [{ slug: 'navy', name: 'Navy', hex: '#000033' }] };
    await assert.rejects(exports.updateProduct(99101, renamed), /stock count to zero/);
    assert.equal((await tx`SELECT name FROM product_colors WHERE product_id = 99101`)[0].name, 'Black');
    await tx`UPDATE inventory_stock SET quantity = 0 WHERE product_id = 99101`;
    await tx`INSERT INTO inventory_reservations (order_id, product_id, color_name, size_label, quantity) VALUES (99201, 99101, 'Black', 'M', 1)`;
    await assert.rejects(exports.updateProduct(99101, renamed), /held for a pending order/);
    await tx`DELETE FROM inventory_reservations WHERE product_id = 99101`;
    assert.equal(await exports.updateProduct(99101, renamed), true);
    assert.equal((await tx`SELECT * FROM inventory_stock WHERE product_id = 99101`).length, 0);
    await tx`INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (99101, 'Black', 'M', 5)`;
    await assert.rejects(exports.updateProduct(99101, input), /old stock count/);
    console.log('PASS: product edits preserve counts, block removal of stocked or held options, and prevent stale counts from returning');
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }

// Verify the editor receives a useful conflict rather than a generic failure.
const routeExports = {};
const routeCode = ts.transpileModule(fs.readFileSync('app/api/admin/products/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const message = 'Set the stock count to zero before changing or removing a color or size.';
const conflict = Object.assign(new Error(message), { name: 'ProductInventoryConflictError' });
const deps = {
  'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
  'next/cache': { revalidatePath() { throw new Error('A rejected edit must not revalidate'); } },
  '../_guard': { requireAdmin: async () => null },
  '@/lib/catalog': { updateProduct: async () => { throw conflict; } },
};
vm.runInNewContext(routeCode, { exports: routeExports, Error, require: name => deps[name] });
const response = await routeExports.PUT(new Request('https://example.test/api/admin/products', {
  method: 'PUT', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: 1, name: 'Fixture', kind: 'tee', basePrice: 10, colors: [{ slug: 'black', name: 'Black', hex: '#000000' }], sizes: [{ label: 'M' }] }),
}));
assert.equal(response.status, 409);
assert.equal(response.body.error, message);
console.log('PASS: the product editor receives the actionable inventory conflict');
