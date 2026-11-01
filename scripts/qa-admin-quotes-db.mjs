import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback fixture");
const compile = (file, deps = {}) => {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`); return deps[name]; } });
  return exports;
};
try {
  await db.begin(async (tx) => {
    const validate = compile("lib/admin-quotes.ts");
    let deny = false;
    const route = compile("app/api/admin/quotes/route.ts", { "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }, "../_guard": { requireAdmin: async () => deny ? { status: 401 } : null }, "@/lib/db": { sql: tx }, "@/lib/admin-quotes": validate });
    const request = (method, body) => new Request("https://example.test/api/admin/quotes", { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const draft = { name: "Quote test", email: "test@example.com", lines: [{ description: "Shirts", quantity: 3, unitCents: 1299 }], shippingCents: 500 };
    deny = true; assert.equal((await route.POST(request("POST", draft))).status, 401); deny = false;
    const created = await route.POST(request("POST", draft)); assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal((await route.PATCH(request("PATCH", { ...draft, id, name: "Updated test" }))).status, 200);
    assert.equal((await route.PATCH(request("PATCH", { id, action: "invoice" }))).status, 200);
    assert.equal((await route.PATCH(request("PATCH", { ...draft, id }))).status, 409);
    assert.equal((await route.PATCH(request("PATCH", { id, action: "invoice" }))).status, 409);
    const [stored] = await tx`SELECT customer_name, status, invoiced_at FROM admin_quotes WHERE id = ${id}::bigint`;
    assert.equal(stored.customer_name, "Updated test"); assert.equal(stored.status, "invoice"); assert.ok(stored.invoiced_at);
    console.log("PASS: guarded quote creation, editing, conversion and invoice locking");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
