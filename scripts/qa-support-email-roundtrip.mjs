import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

const emailId = "01234567-89ab-cdef-0123-456789abcdef", token = "a".repeat(48), sent = [], inserts = [];
let sender = "owner@example.test", audience = "owner", dmarc = "pass";
const sql = async (strings, ...values) => {
  if (strings[0].includes("SELECT c.id")) return [{ id: "1", name: "Buyer", email: "buyer@example.test", audience }];
  inserts.push(values); return [];
};
const exports = {};
const code = ts.transpileModule(fs.readFileSync("app/api/support/inbound/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const deps = { "node:crypto": { createHash, createHmac }, "svix": { Webhook: class { verify() {} } }, "next/server": { NextResponse }, "@/lib/db": { sql }, "@/lib/email": { sendEmail: async (message) => { sent.push(message); return "ok"; } }, "@/lib/limited-form-data": { limitedText: request => request.text() } };
vm.runInNewContext(code, { exports, process: { env: { RESEND_WEBHOOK_SECRET: "fixture-secret", RESEND_INBOUND_API_KEY: "fixture", SUPPORT_INBOUND_DOMAIN: "reply.example.test", SUPPORT_EMAIL: "owner@example.test" } }, fetch: async () => ({ ok: true, json: async () => ({ from: sender, to: [`kcp-${token}@reply.example.test`], text: "Hello there\n\nOn Tuesday, someone wrote:\n> old message", authentication: { dmarc } }) }), AbortSignal, require: (name) => { assert.ok(name in deps, name); return deps[name]; } });
const request = () => new Request("https://example.test/api/support/inbound", { method: "POST", headers: { "svix-id": "1", "svix-timestamp": "1", "svix-signature": "1" }, body: JSON.stringify({ type: "email.received", data: { email_id: emailId } }) });
assert.equal((await exports.POST(request())).status, 200);
assert.equal(sent[0].to, "buyer@example.test"); assert.match(sent[0].replyTo, /^kcp-[a-f0-9]{48}@reply\.example\.test$/);
assert.ok(sent[0].text.includes("Hello there")); assert.ok(!sent[0].text.includes("old message"));
assert.equal((await exports.POST(request())).status, 200);
assert.equal(sent[0].replyTo, sent[1].replyTo); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
audience = "customer"; sender = "buyer@example.test";
assert.equal((await exports.POST(request())).status, 200); assert.equal(sent[2].to, "owner@example.test");
sender = "attacker@example.test"; assert.equal((await exports.POST(request())).status, 200); assert.equal(sent.length, 3);
sender = "buyer@example.test"; dmarc = "fail"; assert.equal((await exports.POST(request())).status, 200); assert.equal(sent.length, 3);
assert.ok(inserts.length >= 6);
console.log("PASS: owner and customer replies route both ways, reject unverified senders, and retry idempotently");
