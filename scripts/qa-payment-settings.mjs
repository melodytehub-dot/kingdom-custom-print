import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { NextResponse } from "next/server.js";

const require = createRequire(import.meta.url);
async function load(path, dependencies, globals = {}) {
  const source = await readFile(path, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => dependencies[name] ?? require(name), process, Buffer, URL, console, ...globals });
  return exports;
}

const oldKey = process.env.PAYMENT_CREDENTIALS_KEY;
process.env.PAYMENT_CREDENTIALS_KEY = "13".repeat(32);
try {
  const db = new Map();
  const sql = async (strings, ...values) => {
    const query = strings.join(" ");
    if (query.includes("SELECT ciphertext")) return db.has(values[0]) ? [{ ciphertext: db.get(values[0]) }] : [];
    if (query.includes("SELECT name")) return [...db.keys()].map((name) => ({ name }));
    if (query.includes("INSERT INTO payment_credentials")) { db.set(values[0], values[1]); return []; }
    throw Error("Unexpected query");
  };
  sql.begin = (fn) => fn(sql);
  const vault = await load("lib/payment-credentials.ts", { "./db": { sql } });
  const secret = "sk_live_example_secret";
  await vault.savePaymentCredentials({ STRIPE_SECRET_KEY: secret });
  assert.notEqual(db.get("STRIPE_SECRET_KEY"), secret);
  assert.equal(await vault.getPaymentCredential("STRIPE_SECRET_KEY"), secret);
  db.set("STRIPE_WEBHOOK_SECRET", db.get("STRIPE_SECRET_KEY"));
  await assert.rejects(vault.getPaymentCredential("STRIPE_WEBHOOK_SECRET"));
  assert.equal((await vault.paymentCredentialStatus()).STRIPE_SECRET_KEY, true);
  console.log("PASS encrypted payment secrets round-trip and reject ciphertext copied to another field");

  let saved = null;
  const settings = await load("app/api/admin/payment-settings/route.ts", {
    "next/server": { NextResponse },
    "../_guard": { requireAdmin: async () => null },
    "@/lib/admin-auth": { passwordMatches: (value) => value === "correct" },
    "@/lib/customer-auth": { sameOrigin: () => true, authAttemptAllowed: async () => true },
    "@/lib/payment-credentials": { ...vault, savePaymentCredentials: async (value) => { saved = value; } },
  });
  const settingsRequest = (password, fields) => new Request("https://example.com/api/admin/payment-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, fields }) });
  assert.equal((await settings.PUT(settingsRequest("wrong", { STRIPE_SECRET_KEY: secret }))).status, 403);
  assert.equal(saved, null);
  assert.equal((await settings.PUT(settingsRequest("correct", { STRIPE_SECRET_KEY: "wrong-key" }))).status, 422);
  assert.equal((await settings.PUT(settingsRequest("correct", { STRIPE_SECRET_KEY: "sk_test_example_secret" }))).status, 422);
  const savedResponse = await settings.PUT(settingsRequest("correct", { STRIPE_SECRET_KEY: secret }));
  assert.equal(savedResponse.status, 200);
  assert.equal(saved.STRIPE_SECRET_KEY, secret);
  assert.ok(!(await savedResponse.text()).includes(secret));
  console.log("PASS payment settings require reauthentication, validate Stripe keys, and never return credentials");

  let submitted = null;
  let allowed = true;
  const route = await load("app/api/admin/refund/route.ts", {
    "next/server": { NextResponse },
    "../_guard": { requireAdmin: async () => null },
    "@/lib/admin-auth": { passwordMatches: (value) => value === "correct" },
    "@/lib/customer-auth": { sameOrigin: () => allowed, authAttemptAllowed: async () => true },
    "@/lib/db": { sql: async () => [{ paid_at: new Date(), stripe_payment_intent: "pi_fixture", status: "paid" }] },
    "@/lib/stripe": { stripeClient: async () => ({ refunds: { create: async (params, options) => { submitted = { params, options }; return { status: "pending" }; } } }) },
    "@/lib/paypal": { paypalRequest: async () => ({ status: "COMPLETED" }) },
  });
  const request = (password) => new Request("https://example.com/api/admin/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: "KCP-ABC234", password }) });
  assert.equal((await route.POST(request("wrong"))).status, 403);
  assert.equal(submitted, null);
  allowed = false;
  assert.equal((await route.POST(request("correct"))).status, 403);
  allowed = true;
  assert.equal((await route.POST(request("correct"))).status, 200);
  assert.equal(submitted.params.payment_intent, "pi_fixture");
  assert.equal(submitted.options.idempotencyKey, "full-refund-KCP-ABC234");
  console.log("PASS refund requires admin reauthentication and same origin and uses a stable idempotency key");
} finally {
  if (oldKey === undefined) delete process.env.PAYMENT_CREDENTIALS_KEY;
  else process.env.PAYMENT_CREDENTIALS_KEY = oldKey;
}
