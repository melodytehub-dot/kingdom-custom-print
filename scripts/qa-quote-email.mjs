import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

let denied = false, changed = false, email = [], storedHash = "";
const deps = {
  "node:crypto": { createHash, randomBytes }, "next/server": { NextResponse },
  "../../_guard": { requireAdmin: async () => denied ? NextResponse.json({}, { status: 401 }) : null },
  "@/lib/customer-auth": { authAttemptAllowed: async () => true },
  "@/lib/email": { emailConfigured: () => true, sendEmail: async (message) => { email.push(message); return "fixture"; } },
  "@/lib/catalog": { getSettings: async () => ({ contactEmail: "owner@example.test" }) },
  "@/lib/site-url": { publicSiteUrl: () => "https://example.test" },
  "@/lib/db": { sql: async (strings, ...values) => {
    if (strings[0].includes("SELECT customer_name")) return [{ customer_name: "Customer", customer_email: "buyer@example.test" }];
    storedHash = values[0]; return changed ? [] : [{ quote_id: 1 }];
  } },
};
const exports = {};
const code = ts.transpileModule(fs.readFileSync("app/api/admin/quotes/send-quote/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in deps, name); return deps[name]; } });
const request = (id) => new Request("https://example.test/api/admin/quotes/send-quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
denied = true; assert.equal((await exports.POST(request("1"))).status, 401); denied = false;
assert.equal((await exports.POST(request("bad"))).status, 422);
changed = true; assert.equal((await exports.POST(request("1"))).status, 409); assert.equal(email.length, 0); changed = false;
assert.equal((await exports.POST(request("1"))).status, 200); assert.equal(email.length, 1);
const url = new URL(email[0].action.url); const token = url.pathname.split("/").pop();
assert.match(url.pathname, /^\/quote\/[A-Za-z0-9_-]{43}$/);
assert.equal(storedHash, createHash("sha256").update(token).digest("hex"));
assert.equal(email[0].to, "buyer@example.test");
console.log("PASS: quote email is admin-only, detects concurrent changes, and shares a hashed private link");
