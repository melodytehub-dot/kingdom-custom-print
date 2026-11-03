import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

let account;
let sessions = 0;
let messages = 0;
let failDelivery = false;
const sql = async (parts, ...values) => {
  const query = parts.join(" ");
  if (query.includes("INSERT INTO customer_accounts")) {
    if (account) return [];
    account = { id: 1, email: values[0], name: values[1], password_hash: values[2], email_verified: false };
    return [account];
  }
  if (query.includes("SELECT id, email, name, email_verified")) return account ? [account] : [];
  throw new Error("Unexpected database query");
};
const auth = {
  CUSTOMER_COOKIE: "customer_session",
  sameOrigin: (req) => req.headers.get("origin") === "https://example.test",
  authAttemptAllowed: async () => true,
  normalizedEmail: (value) => value.trim().toLowerCase(),
  passwordHash: async (value) => `hash:${value}`,
  passwordValid: async (value, hash) => hash === `hash:${value}`,
  createCustomerSession: async () => { sessions++; return "session-fixture"; },
  customerCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: "lax" }),
};
const deps = {
  "next/server": { NextResponse },
  "@/lib/db": { sql },
  "@/lib/customer-auth": auth,
  "@/lib/account-verification": { sendAccountVerification: async () => { messages++; if (failDelivery) throw new Error("delivery failed"); } },
  "@/lib/limited-form-data": { limitedJson: (request) => request.json() },
};
const source = fs.readFileSync("app/api/account/auth/route.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports, require: (name) => { if (!deps[name]) throw new Error(`Missing mock: ${name}`); return deps[name]; }, console: { error() {} } });
const request = (mode, origin = "https://example.test") => new Request("https://example.test/api/account/auth", {
  method: "POST", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ mode, email: "Customer@example.test", name: "Customer", password: "safe-test-password" }),
});

assert.equal((await exports.POST(request("register", "https://other.test"))).status, 403);
let response = await exports.POST(request("register"));
assert.equal(response.status, 200);
assert.equal((await response.json()).verificationRequired, true);
assert.equal(account.email_verified, false);
assert.equal(sessions, 0);
assert.equal(response.headers.get("set-cookie"), null);
assert.equal(messages, 1);
response = await exports.POST(request("login"));
assert.equal((await response.json()).verificationRequired, true);
assert.equal(sessions, 0);
assert.equal(messages, 2);
failDelivery = true;
response = await exports.POST(request("login"));
assert.equal(response.status, 503);
assert.equal(sessions, 0);
account.email_verified = true;
response = await exports.POST(request("login"));
assert.equal(response.status, 200);
assert.equal(sessions, 1);
assert.match(response.headers.get("set-cookie"), /customer_session=/);
console.log("PASS: registration and unverified sign-in require email confirmation; only verified accounts receive a session");
