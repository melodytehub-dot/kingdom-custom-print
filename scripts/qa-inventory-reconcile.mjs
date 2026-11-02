import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

let denied = false, order = { status: "pending", stripe_session_id: "cs_fixture", paypal_order_id: null };
let stripeStatus = "open", paypalStatus = "APPROVED", cancellations = [];
const deps = {
  "next/server": { NextResponse }, "../../_guard": { requireAdmin: async () => denied ? NextResponse.json({}, { status: 401 }) : null },
  "@/lib/customer-auth": { authAttemptAllowed: async () => true }, "@/lib/db": { sql: async () => [order] },
  "@/lib/stripe": { stripeClient: async () => ({ checkout: { sessions: { retrieve: async () => ({ status: stripeStatus, payment_status: "unpaid" }) } } }) },
  "@/lib/paypal": { paypalRequest: async () => ({ status: paypalStatus }) },
  "@/lib/orders": { cancelOrder: async (reference, options) => { cancellations.push({ reference, options }); return true; } },
};
const exports = {};
const code = ts.transpileModule(fs.readFileSync("app/api/admin/inventory/reconcile/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { exports, require: (name) => deps[name] });
const request = () => new Request("https://example.test/api/admin/inventory/reconcile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference: "KCP-ABC234" }) });
denied = true; assert.equal((await exports.POST(request())).status, 401); denied = false;
assert.equal((await exports.POST(request())).status, 409); assert.equal(cancellations.length, 0);
stripeStatus = "expired"; assert.equal((await exports.POST(request())).status, 200);
assert.equal(cancellations[0].options.stripeSessionId, "cs_fixture"); assert.equal(cancellations[0].options.providerClosed, true);
order = { status: "pending", stripe_session_id: null, paypal_order_id: "PAYPAL123" };
assert.equal((await exports.POST(request())).status, 409); assert.equal(cancellations.length, 1);
paypalStatus = "VOIDED"; assert.equal((await exports.POST(request())).status, 200);
assert.equal(cancellations[1].options.paypalOrderId, "PAYPAL123");
console.log("PASS: provider verification releases holds only after a confirmed terminal state");
