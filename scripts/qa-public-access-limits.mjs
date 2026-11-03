import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(file, dependencies = {}) {
  const exports = {};
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { if (!dependencies[name]) throw new Error(`Missing mock ${name}`); return dependencies[name]; }, Request, Headers, Blob, Uint8Array, Number, RangeError, URL });
  return exports;
}
const limited = load("lib/limited-form-data.ts");
const origin = { sameOrigin: (request) => request.headers.get("origin") === "https://example.test" };
let matched = 0;
const access = load("app/api/order/access/route.ts", {
  "next/server": { NextResponse }, "@/lib/customer-auth": origin, "@/lib/limited-form-data": limited,
  "@/lib/order-access": { ORDER_ACCESS_COOKIE: "order_access", orderAccessCookieOptions: () => ({ httpOnly: true }), orderAccessAttemptAllowed: async () => true, verifyGuestOrder: async () => { matched++; return "fixture"; } },
});
const json = (body) => new Request("https://example.test/api/order/access", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body });
assert.equal((await access.POST(json("null"))).status, 400);
assert.equal((await access.POST(json(JSON.stringify({ reference: "KCP-ABC234", email: "a".repeat(5000) })))).status, 413);
assert.equal(matched, 0);
assert.equal((await access.POST(json(JSON.stringify({ reference: "KCP-ABC234", email: "buyer@example.test" })))).status, 200);
assert.equal(matched, 1);

let available = true, verified = false;
const tx = async (parts) => {
  const query = parts.join(" ");
  if (query.includes("DELETE FROM customer_email_verifications") && query.includes("RETURNING")) { if (!available) return []; available = false; return [{ account_id: 1 }]; }
  if (query.includes("UPDATE customer_accounts")) { verified = true; return []; }
  if (query.includes("DELETE FROM customer_email_verifications")) return [];
  throw new Error("Unexpected query");
};
const verify = load("app/api/account/verify/route.ts", {
  "next/server": { NextResponse }, "@/lib/customer-auth": origin, "@/lib/limited-form-data": limited,
  "@/lib/db": { sql: { begin: (fn) => fn(tx) } }, "@/lib/account-verification": { verificationHash: (token) => token },
});
const form = (token) => new Request("https://example.test/api/account/verify", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
assert.equal((await verify.POST(form("a".repeat(5000)))).status, 413);
assert.equal(available, true);
let result = await verify.POST(form("a".repeat(64)));
assert.equal(result.status, 303);
assert.match(result.headers.get("location"), /verification=success/);
assert.equal(verified, true);
result = await verify.POST(form("a".repeat(64)));
assert.match(result.headers.get("location"), /verification=invalid/);
console.log("PASS: public account and order access reject oversized input; valid verification is single-use");
