import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import postgres from "postgres";
import { Webhook } from "svix";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback fixture");
const inboundId = "12345678-1234-1234-1234-123456789012";
const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
try {
  await db.begin(async (tx) => {
    let sent;
    const NextResponse = { json(body, opts = {}) { return { body, status: opts.status ?? 200, cookies: { set(name, value) { this.name = name; this.value = value; } } }; } };
    const env = { NODE_ENV: "test", SUPPORT_EMAIL: "owner@example.test", SUPPORT_INBOUND_DOMAIN: "inbound.example.test", RESEND_INBOUND_API_KEY: "fixture", RESEND_WEBHOOK_SECRET: secret };
    const deps = { "node:crypto": crypto, "next/server": { NextResponse }, "@/lib/customer-auth": { sameOrigin: () => true, authAttemptAllowed: async () => true }, "@/lib/email": { emailConfigured: () => true, sendEmail: async (message) => { sent = message; return "fixture"; } }, "@/lib/db": { sql: tx }, svix: { Webhook } };
    const compile = file => {
      const exports = {};
      const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
      vm.runInNewContext(source, { exports, require: name => deps[name], process: { env }, fetch: async () => ({ ok: true, json: async () => ({ from: "Owner <owner@example.test>", to: [sent.replyTo], text: "Hello, we can help!", authentication: { dmarc: "pass" } }) }), AbortSignal });
      return exports;
    };
    const support = compile("app/api/support/route.ts");
    const inbound = compile("app/api/support/inbound/route.ts");
    const created = await support.POST(new Request("https://example.test/api/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Test customer", email: "buyer@example.test", message: "Can you help with my design?" }) }));
    assert.equal(created.status, 200); assert.match(sent.replyTo, /^kcp-[a-f0-9]{48}@inbound\.example\.test$/);
    const payload = JSON.stringify({ type: "email.received", data: { email_id: inboundId } });
    const at = new Date(), id = "msg_fixture";
    const signature = new Webhook(secret).sign(id, at, payload);
    const makeInbound = () => new Request("https://example.test/api/support/inbound", { method: "POST", headers: { "svix-id": id, "svix-timestamp": String(Math.floor(at.getTime() / 1000)), "svix-signature": signature }, body: payload });
    assert.equal((await inbound.POST(makeInbound())).status, 200);
    assert.equal((await inbound.POST(makeInbound())).status, 200);
    const viewed = await support.GET(new Request("https://example.test/api/support", { headers: { cookie: `${created.cookies.name}=${created.cookies.value}` } }));
    assert.equal(viewed.body.messages.length, 2);
    assert.equal(viewed.body.messages[1].body, "Hello, we can help!");
    const stranger = await support.GET(new Request("https://example.test/api/support", { headers: { cookie: `kcp_support=${"f".repeat(64)}` } }));
    assert.equal(stranger.body.messages.length, 0);
    console.log("PASS: conversation creation, signed email reply, replay handling and session isolation");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
