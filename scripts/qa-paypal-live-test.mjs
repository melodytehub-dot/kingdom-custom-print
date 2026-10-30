import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { NextResponse } from "next/server.js";
const require = createRequire(import.meta.url);
let allowed = false, status = "APPROVED", refundCalls = 0;
const order = () => ({ id: "TESTORDER1", status, purchase_units: [{ custom_id: "KCP-ADMIN-ONE-DOLLAR-TEST", amount: { currency_code: "USD", value: "1.00" }, payments: { captures: status === "COMPLETED" ? [{ id: "CAPTURE1", status: "COMPLETED", amount: { currency_code: "USD", value: "1.00" } }] : [] } }] });
const paypalRequest = async (path, options = {}) => {
  if (path === "/v2/checkout/orders") { assert.equal(JSON.parse(options.body).purchase_units[0].amount.value, "1.00"); return { id: "TESTORDER1", links: [{ rel: "payer-action", href: "https://www.paypal.com/checkoutnow" }] }; }
  if (path.endsWith("/capture")) { status = "COMPLETED"; return order(); }
  if (path.endsWith("/refund")) { refundCalls++; return { status: "COMPLETED" }; }
  return order();
};
const source = await readFile("app/api/admin/paypal-test/route.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
const deps = { "next/server": { NextResponse }, "../_guard": { requireAdmin: async () => allowed ? null : NextResponse.json({}, { status: 401 }) }, "@/lib/paypal": { paypalRequest, PayPalRequestError: class PayPalRequestError extends Error {} }, "@/lib/stripe": { siteUrl: () => "https://kingdomcustomprint.com" } };
vm.runInNewContext(code, { exports, require: name => deps[name] ?? require(name), console });
const request = (body, cookie = "") => new Request("https://kingdomcustomprint.com/api/admin/paypal-test", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) });
assert.equal((await exports.POST(request({ action: "start" }))).status, 401);
allowed = true;
const start = await exports.POST(request({ action: "start" }));
assert.equal(start.status, 200);
assert.match(start.headers.get("set-cookie"), /HttpOnly/i);
assert.equal((await exports.POST(request({ action: "capture", token: "OTHER" }, "kcp_paypal_test=TESTORDER1"))).status, 400);
const capture = await exports.POST(request({ action: "capture", token: "TESTORDER1" }, "kcp_paypal_test=TESTORDER1"));
assert.equal((await capture.json()).captureStatus, "COMPLETED");
const refund = await exports.POST(request({ action: "refund", token: "TESTORDER1" }, "kcp_paypal_test=TESTORDER1"));
assert.equal((await refund.json()).refundStatus, "COMPLETED");
assert.equal(refundCalls, 1);
console.log("PASS admin-only $1 PayPal test enforces order match, captures, and requests refund");
