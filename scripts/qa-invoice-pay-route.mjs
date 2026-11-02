import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";
const id = "11111111-1111-4111-8111-111111111111", token = "a".repeat(43);
let createOptions, requestOptions, configured = true;
const attempt = { id, state: "creating", amount_cents: "1200", provider_id: null, checkout_url: null };
class InvoicePaymentError extends Error {}
const stripe = { checkout: { sessions: { create: async (params, options) => { createOptions = { params, options }; return { id: "cs_fixture", url: "https://checkout.stripe.com/fixture" }; } } } };
const deps = {
  "node:crypto": { createHash }, "next/server": { NextResponse },
  "@/lib/customer-auth": { sameOrigin: () => true, authAttemptAllowed: async () => true },
  "@/lib/paypal": { paypalConfigured: async () => configured, paypalRequest: async (_path, options) => { requestOptions = options; return { id: "PAYPAL123", links: [{ rel: "approve", href: "https://www.paypal.com/checkoutnow?token=PAYPAL123" }] }; } },
  "@/lib/stripe": { paymentsConfigured: async () => configured, siteUrl: () => "https://example.test", stripeClient: async () => stripe },
  "@/lib/invoice-payments": { InvoicePaymentError, reserveInvoicePayment: async () => ({ invoice: { id: "42", customer_email: "buyer@example.test" }, attempt }), attachInvoiceCheckout: async () => ({ state: "open" }), closeStripeInvoiceSession: async () => {}, recordStripeInvoicePayment: async () => {} },
};
const exports = {};
const code = ts.transpileModule(fs.readFileSync("app/api/invoice/pay/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in deps, name); return deps[name]; } });
const request = (body) => new Request("https://example.test/api/invoice/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
assert.equal((await exports.POST(request({ token: "bad", provider: "stripe" }))).status, 400);
configured = false; assert.equal((await exports.POST(request({ token, provider: "stripe" }))).status, 503); configured = true;
assert.equal((await exports.POST(request({ token, provider: "stripe", amount: 1 }))).status, 200);
assert.equal(createOptions.params.line_items[0].price_data.unit_amount, 1200);
assert.equal(createOptions.params.metadata.invoiceAttemptId, id);
assert.equal(createOptions.options.idempotencyKey, `invoice-${id}`);
assert.ok(!createOptions.params.success_url.includes(token));
assert.equal((await exports.POST(request({ token, provider: "paypal", amount: 1 }))).status, 200);
const paypal = JSON.parse(requestOptions.body);
assert.equal(paypal.purchase_units[0].amount.value, "12.00");
assert.equal(requestOptions.requestId, `i-${id.replaceAll("-", "")}`);
assert.ok(!paypal.payment_source.paypal.experience_context.return_url.includes(token));
console.log("PASS: invoice checkout uses server totals, stable provider idempotency keys, and private return URLs");
