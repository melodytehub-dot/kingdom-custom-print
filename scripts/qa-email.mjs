import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import vm from "node:vm";
import { NextResponse } from "next/server.js";

const source = await readFile("lib/email.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { sendEmail, emailConfigured } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const original = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM, support: process.env.SUPPORT_EMAIL, fetch: globalThis.fetch };
try {
  delete process.env.RESEND_API_KEY;
  assert.equal(emailConfigured(), false);
  await assert.rejects(sendEmail({ to: "customer@example.com", subject: "Test", text: "Test" }), /not configured/);
  process.env.RESEND_API_KEY = "test-key";
  delete process.env.RESEND_FROM;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: "test-message" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  assert.equal(await sendEmail({ to: "customer@example.com", subject: "Test", text: "Hello", replyTo: "support@example.com", idempotencyKey: "order-receipt/KCP-TEST" }), "test-message");
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers["Idempotency-Key"], "order-receipt/KCP-TEST");
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.to, ["customer@example.com"]);
  assert.equal(body.reply_to, "support@example.com");
  assert.match(body.from, /@send\.kingdomcustomprint\.com/);
  globalThis.fetch = async () => new Response("error", { status: 503 });
  await assert.rejects(sendEmail({ to: "customer@example.com", subject: "Test", text: "Test" }), /503/);
  console.log("PASS Resend configuration, sender, reply-to, idempotency, and provider failure handling");

  let sent = false;
  let deliveries = 0;
  const fakeSql = async (parts) => {
    if (parts.join("").includes("SELECT reference")) return sent ? [{ reference: "KCP-TEST" }] : [];
    if (parts.join("").includes("INSERT INTO")) { sent = true; return []; }
    throw new Error("Unexpected SQL");
  };
  const receiptSource = await readFile("lib/order-email.ts", "utf8");
  const receiptCode = ts.transpileModule(receiptSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const receiptExports = {};
  const dependencies = {
    "./db": { sql: fakeSql },
    "./email": { sendEmail: async () => { deliveries++; return "test-message"; } },
    "./orders": { getOrderByReference: async () => ({ status: "paid", name: "Customer", email: "customer@example.com", total: 20, items: [] }) },
    "./site-url": { publicSiteUrl: () => "https://kingdomcustomprint.com" },
  };
  vm.runInNewContext(receiptCode, { exports: receiptExports, require: (name) => dependencies[name] });
  await receiptExports.sendPaidOrderReceipt("KCP-TEST");
  await receiptExports.sendPaidOrderReceipt("KCP-TEST");
  assert.equal(deliveries, 1);
  console.log("PASS a replayed paid-order event does not send a second receipt");

  const contactSource = await readFile("app/api/contact/route.ts", "utf8");
  const contactCode = ts.transpileModule(contactSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const contactExports = {};
  let contactMessages = [];
  let rateAllowed = true;
  const contactDependencies = {
    "next/server": { NextResponse },
    "@/lib/customer-auth": { sameOrigin: () => true, authAttemptAllowed: async () => rateAllowed },
    "@/lib/email": { emailConfigured: () => true, sendEmail: async (message) => { contactMessages.push(message); return "test-message"; } },
  };
  process.env.SUPPORT_EMAIL = "support@example.com";
  vm.runInNewContext(contactCode, { exports: contactExports, require: (name) => contactDependencies[name], process, Request, Response });
  const contactRequest = (data) => new Request("https://kingdomcustomprint.com/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  assert.equal((await contactExports.POST(contactRequest({ name: "A", email: "invalid", message: "short" }))).status, 422);
  const valid = { name: "Customer", email: "customer@example.com", message: "Please help with my shirt design." };
  assert.equal((await contactExports.POST(contactRequest(valid))).status, 200);
  assert.equal(contactMessages.length, 1);
  assert.equal(contactMessages[0].to, "support@example.com");
  assert.equal(contactMessages[0].replyTo, "customer@example.com");
  rateAllowed = false;
  assert.equal((await contactExports.POST(contactRequest(valid))).status, 429);
  assert.equal(contactMessages.length, 1);
  console.log("PASS contact validation, recipient, reply-to, and rate limiting");
} finally {
  if (original.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = original.key;
  if (original.from === undefined) delete process.env.RESEND_FROM; else process.env.RESEND_FROM = original.from;
  if (original.support === undefined) delete process.env.SUPPORT_EMAIL; else process.env.SUPPORT_EMAIL = original.support;
  globalThis.fetch = original.fetch;
}
