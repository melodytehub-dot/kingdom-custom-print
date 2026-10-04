/** Payment contract tests exercise route handlers with a mock catalog and
 * Stripe transport. No external charges or database writes are made. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import Stripe from "stripe";
import { NextResponse } from "next/server.js";
function load(file, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, process, console, Request, Response, URL, Buffer }, { filename: file });
  return exports;
}
const pricing = load("lib/pricing.ts", {});
const product = { id: 1, active: true, name: "Catalog tee", slug: "catalog-tee", kind: "tee", basePrice: 10, printFeePerSide: 4, priceBreaks: [], colors: [{ name: "Black", hex: "#111111" }], sizes: [{ label: "M", surcharge: 0 }, { label: "2XL", surcharge: 3 }] };
let configured = false;
let orderInput;
let sessionInput;
let writes = 0;
const checkout = load("app/api/checkout/route.ts", {
  "next/server": { NextResponse },
  "@/lib/orders": { createOrder: async input => { writes++; orderInput = input; const subtotal = input.items.reduce((sum, item) => sum + item.total, 0); return { reference: "KCP-TEST01", subtotal, shipping: 6.95, total: subtotal + 6.95 }; }, attachStripeSession: async () => {} },
  "@/lib/stripe": { paymentsConfigured: () => configured, siteUrl: () => "https://kingdom.example", stripeClient: () => ({ checkout: { sessions: { create: async input => { sessionInput = input; return { id: "cs_test_local", url: "https://checkout.stripe.com/test" }; } } } }) },
  "@/lib/catalog": { getProductById: async () => product },
  "@/lib/pricing": pricing,
  "@/lib/fonts": { FONTS: [{ id: "Anton" }] },
  "@/lib/design": { personalizationOf: () => "none" },
});
const payload = { email: "qa@example.com", name: "Test buyer", addressLine1: "1 Test Street", city: "Austin", postal: "78701", region: "TX", items: [{ productId: 1, productName: "Fake client name", quantity: 999, unitPrice: .01, total: .01, colorName: "Fake color", colorHex: "#ff0000", lines: [{ label: "M", qty: 2 }, { label: "2XL", qty: 1 }], design: { front: [], back: [] } }] };
const request = data => new Request("https://kingdom.example/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
let response = await checkout.POST(request(payload));
assert.equal(response.status, 503);
assert.equal(writes, 0);
console.log("PASS missing Stripe configuration refuses checkout without creating an order");
configured = true;
response = await checkout.POST(request(payload));
assert.equal(response.status, 200);
assert.equal(orderInput.items[0].productName, product.name);
assert.equal(orderInput.items[0].quantity, 3);
assert.equal(orderInput.items[0].colorName, "Black");
assert.equal(orderInput.items[0].total, 33);
const charged = sessionInput.line_items.reduce((sum, item) => sum + item.quantity * item.price_data.unit_amount, 0);
assert.equal(charged, 3300);
assert.equal(sessionInput.shipping_options[0].shipping_rate_data.fixed_amount.amount, 695);
assert.equal(sessionInput.payment_method_types[0], "card");
console.log("PASS server prices override client tampering, quantity, names and colors; Stripe includes size surcharges exactly");
response = await checkout.POST(request({ ...payload, items: [{ ...payload.items[0], lines: [{ label: "INVALID", qty: 1 }] }] }));
assert.equal(response.status, 400);
assert.equal(writes, 1);
console.log("PASS invalid sizes cannot create an order");
const stripe = new Stripe("sk_test_local_fixture");
const secret = "whsec_local_fixture";
const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
process.env.STRIPE_WEBHOOK_SECRET = secret;
let paidCalls = 0;
const webhook = load("app/api/webhook/route.ts", {
  "next/server": { NextResponse },
  "@/lib/orders": { markOrderPaid: async () => { paidCalls++; } },
  "@/lib/stripe": { stripeClient: () => stripe },
});
async function event(status, type = "checkout.session.completed", valid = true) {
  const body = JSON.stringify({ id: "evt_local", type, data: { object: { id: "cs_test_local", payment_status: status, payment_intent: "pi_local" } } });
  const signature = valid ? stripe.webhooks.generateTestHeaderString({ payload: body, secret }) : "t=0,v1=invalid";
  return webhook.POST(new Request("https://kingdom.example/api/webhook", { method: "POST", headers: { "stripe-signature": signature }, body }));
}
try {
  assert.equal((await event("unpaid")).status, 200);
  assert.equal(paidCalls, 0);
  assert.equal((await event("paid", "checkout.session.completed", false)).status, 400);
  assert.equal(paidCalls, 0);
  assert.equal((await event("paid")).status, 200);
  assert.equal(paidCalls, 1);
  assert.equal((await event("paid", "checkout.session.async_payment_succeeded")).status, 200);
  assert.equal(paidCalls, 2);
  console.log("PASS signed Stripe events: unpaid ignored, invalid signatures rejected, paid events accepted");
} finally {
  if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
}
console.log("ALL PAYMENT CONTRACT CHECKS PASSED (live Stripe checkout still requires credentials)");
