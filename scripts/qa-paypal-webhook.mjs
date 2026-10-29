import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

const code = ts.transpileModule(fs.readFileSync("app/api/paypal/webhook/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
let verified = false, marks = 0, receipts = 0, approved = 0, refundMarks = 0, verificationBody = "";
const dependencies = {
  "next/server": { NextResponse },
  "@/lib/paypal": { paypalConfigured: async () => true, paypalRequest: async (path, opts) => { if (path.includes("verify-webhook")) { verificationBody = opts.body; return { verification_status: verified ? "SUCCESS" : "FAILURE" }; } return { status: "REFUNDED" }; } },
  "@/lib/payment-credentials": { getPaymentCredential: async () => "webhook-fixture" },
  "@/lib/paypal-capture": { capturePayPalOrder: async () => { approved++; } },
  "@/lib/orders": { recordPayPalCapture: async (_order, _capture, amount, currency) => { if (amount !== "10.00" || currency !== "USD") return null; marks++; return { reference: "KCP-ABC234" }; }, markPayPalRefunded: async () => { refundMarks++; } },
  "@/lib/order-email": { sendPaidOrderReceipt: async () => { receipts++; } },
};
const exports = {};
vm.runInNewContext(code, { exports, require: name => { if (!(name in dependencies)) throw Error(`Unexpected dependency ${name}`); return dependencies[name]; }, console, URL, Request, Response, JSON });
const headers = { "paypal-auth-algo": "fixture", "paypal-cert-url": "fixture", "paypal-transmission-id": "fixture", "paypal-transmission-sig": "fixture", "paypal-transmission-time": "fixture" };
const raw = '{ "id":"evt-1", "event_type":"PAYMENT.CAPTURE.COMPLETED", "resource":{"id":"CAPTURE1","amount":{"value":"10.00","currency_code":"USD"},"supplementary_data":{"related_ids":{"order_id":"ORDER1"}}} }';
const request = (body, h = headers) => new Request("https://example.com/api/paypal/webhook", { method: "POST", headers: h, body });
assert.equal((await exports.POST(request(raw, {}))).status, 400);
assert.equal((await exports.POST(request(raw))).status, 400);
assert.equal(marks, 0);
assert.ok(verificationBody.includes(raw));
verified = true;
assert.equal((await exports.POST(request(raw))).status, 200);
assert.equal(marks, 1); assert.equal(receipts, 1);
assert.equal((await exports.POST(request(JSON.stringify({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "ORDER1" } })))).status, 200);
assert.equal(approved, 1);
assert.equal((await exports.POST(request(JSON.stringify({ event_type: "PAYMENT.CAPTURE.REFUNDED", resource: { supplementary_data: { related_ids: { capture_id: "CAPTURE1" } } } })))).status, 200);
assert.equal(refundMarks, 1);
console.log("PASS PayPal webhooks require verification, preserve the original event, and handle capture and refund notifications");
