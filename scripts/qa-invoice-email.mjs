import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

let denied = false, emails = [], storedHash = "";
const deps = {
  "node:crypto": { createHash, randomBytes }, "next/server": { NextResponse },
  "../../_guard": { requireAdmin: async () => denied ? NextResponse.json({}, { status: 401 }) : null },
  "@/lib/customer-auth": { authAttemptAllowed: async () => true },
  "@/lib/email": { emailConfigured: () => true, sendEmail: async (message) => { emails.push(message); return "fixture"; } },
  "@/lib/catalog": { getSettings: async () => ({ contactEmail: "owner@example.test" }) },
  "@/lib/site-url": { publicSiteUrl: () => "https://example.test" },
  "@/lib/db": { sql: async (strings, ...values) => { if (strings[0].includes("SELECT")) return [{ customer_name: "Customer", customer_email: "buyer@example.test" }]; storedHash = values[0]; return []; } },
};
const exports = {};
const code = ts.transpileModule(fs.readFileSync("app/api/admin/quotes/send/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { exports, require: (name) => deps[name] });
const request = (id) => new Request("https://example.test/api/admin/quotes/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
denied = true; assert.equal((await exports.POST(request("1"))).status, 401); denied = false;
assert.equal((await exports.POST(request("bad"))).status, 422);
assert.equal((await exports.POST(request("1"))).status, 200); assert.equal(emails.length, 1);
const token = new URL(emails[0].action.url).pathname.split("/").pop();
assert.match(token, /^[A-Za-z0-9_-]{43}$/);
assert.equal(storedHash, createHash("sha256").update(token).digest("hex"));
assert.notEqual(storedHash, token);
assert.equal(emails[0].to, "buyer@example.test");
console.log("PASS: invoice delivery requires admin access and stores only a hash of the private link");
