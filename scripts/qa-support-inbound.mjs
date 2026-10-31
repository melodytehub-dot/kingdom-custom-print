import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash } from "node:crypto";
import { Webhook as SignedWebhook } from "svix";

const signingSecret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
const signer = new SignedWebhook(signingSecret);
const signedPayload = '{"type":"email.received"}';
const signedAt = new Date();
const signedHeaders = { "svix-id": "msg_fixture", "svix-timestamp": String(Math.floor(signedAt.getTime() / 1000)), "svix-signature": signer.sign("msg_fixture", signedAt, signedPayload) };
assert.doesNotThrow(() => signer.verify(signedPayload, signedHeaders));
assert.throws(() => signer.verify(`${signedPayload} `, signedHeaders));

const token = "a".repeat(48), emailId = "12345678-1234-1234-1234-123456789012";
const accepted = new Set();
let savedText;
let mail = { from: "Owner <owner@example.com>", to: [`kcp-${token}@inbound.example.com`], text: "Hello customer\n\nOn Monday someone wrote:\n> original", authentication: { dmarc: "pass" } };
const sql = async (strings, ...values) => { assert.equal(values[2], createHash("sha256").update(token).digest("hex")); savedText = values[0]; accepted.add(values[1]); };
class Webhook { verify(body, headers) { if (headers["svix-signature"] !== "valid") throw Error("bad signature"); } }
const exports = {};
const dependencies = { "node:crypto": { createHash }, svix: { Webhook }, "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } }, "@/lib/db": { sql } };
const source = ts.transpileModule(fs.readFileSync("app/api/support/inbound/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(source, { exports, require: name => dependencies[name], process: { env: { RESEND_WEBHOOK_SECRET: "secret", RESEND_INBOUND_API_KEY: "key", SUPPORT_INBOUND_DOMAIN: "inbound.example.com", SUPPORT_EMAIL: "owner@example.com" } }, fetch: async () => ({ ok: true, json: async () => mail }), AbortSignal });
function request(signature = "valid") { return new Request("https://example.test/api/support/inbound", { method: "POST", headers: { "svix-id": "event", "svix-timestamp": "123", "svix-signature": signature }, body: JSON.stringify({ type: "email.received", data: { email_id: emailId } }) }); }
assert.equal((await exports.POST(request("invalid"))).status, 400);
mail = { ...mail, authentication: { dmarc: "fail" } };
await exports.POST(request()); assert.equal(accepted.size, 0);
mail = { ...mail, authentication: { dmarc: "pass" } };
assert.equal((await exports.POST(request())).status, 200); assert.equal(accepted.size, 1);
assert.equal(savedText, "Hello customer");
mail = { ...mail, text: "Yes, thanks for contacting us.\r\n\r\nMT\r\n\r\nOn Sat, Oct 31, 2026 at 12:54 PM Kingdom Custom Print <\r\norders@example.com> wrote:\r\n> Original message" };
await exports.POST(request()); assert.equal(savedText, "Yes, thanks for contacting us.\n\nMT");
mail = { ...mail, text: "Happy to help.\n\n-- \nChinley\nCompany name" };
await exports.POST(request()); assert.equal(savedText, "Happy to help.");
mail = { ...mail, text: "On Monday we can print your design.\nPlease send the artwork.\n\nThank you!" };
await exports.POST(request()); assert.equal(savedText, mail.text);
await exports.POST(request()); assert.equal(accepted.size, 1);
console.log("PASS: signed inbound messages require authenticated owner and replay does not duplicate messages");
