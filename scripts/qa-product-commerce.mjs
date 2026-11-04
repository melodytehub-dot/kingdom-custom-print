import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(file, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const out = {};
  vm.runInNewContext(code, { exports: out, require: name => { if (!(name in deps)) throw new Error(`Missing mock: ${name}`); return deps[name]; }, Request, Response, Headers, Blob, File, FormData, Uint8Array, Buffer, RangeError, console });
  return out;
}
const limits = load("lib/limited-form-data.ts");
const formats = load("lib/imageFormat.ts");
let denied = false;
let savedMedia;
const sql = async (_strings, ...values) => { savedMedia = values; return []; };
const upload = load("app/api/admin/product-media/route.ts", {
  "node:crypto": { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
  "next/server": { NextResponse },
  "../_guard": { requireAdmin: async () => denied ? NextResponse.json({}, { status: 401 }) : null },
  "@/lib/limited-form-data": limits,
  "@/lib/imageFormat": formats,
  "@/lib/db": { sql },
});
function uploadRequest(bytes, type) {
  const data = new FormData(); data.set("image", new File([bytes], "photo", { type }));
  return new Request("https://example.test/api/admin/product-media", { method: "POST", body: data });
}
denied = true;
assert.equal((await upload.POST(uploadRequest(new Uint8Array([255, 216, 255, 0]), "image/jpeg"))).status, 401);
denied = false;
assert.equal((await upload.POST(uploadRequest(new Uint8Array([0, 1, 2]), "image/jpeg"))).status, 422);
const response = await upload.POST(uploadRequest(new Uint8Array([255, 216, 255, 0]), "image/jpeg"));
assert.equal(response.status, 200);
assert.equal((await response.json()).url, "/api/product-media/00000000-0000-4000-8000-000000000001");
assert.equal(savedMedia[1], "image/jpeg");
console.log("PASS product-photo uploads require admin access and check file signatures");

let created;
const photoSql = async () => [{ id: "00000000-0000-4000-8000-000000000001" }];
photoSql.json = value => value;
const products = load("app/api/admin/products/route.ts", {
  "next/server": { NextResponse }, "next/cache": { revalidatePath() {} },
  "../_guard": { requireAdmin: async () => null },
  "@/lib/db": { sql: photoSql },
  "@/lib/catalog": { createProduct: async value => { created = value; return 1; }, getProductById: async () => ({ saleMode: "ready-made", colors: [{ frontImage: null }] }) },
});
const base = { name: "Finished shirt", kind: "tee", saleMode: "ready-made", active: true, basePrice: 20, colors: [{ slug: "black", name: "Black", hex: "#000000" }], sizes: [{ label: "M" }] };
const req = body => new Request("https://example.test/api/admin/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
assert.equal((await products.POST(req(base))).status, 422);
assert.equal((await products.POST(req({ ...base, colors: [{ ...base.colors[0], frontImage: "https://invalid.test/image.jpg" }] }))).status, 422);
assert.equal((await products.POST(req({ ...base, colors: [{ ...base.colors[0], frontImage: "/api/product-media/00000000-0000-4000-8000-000000000001" }] }))).status, 200);
assert.equal(created.saleMode, "ready-made");
const patch = new Request("https://example.test/api/admin/products", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: 1, active: true }) });
assert.equal((await products.PATCH(patch)).status, 422);
console.log("PASS finished products cannot be published without an uploaded photo for each color");
