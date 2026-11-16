/**
 * Support conversations: creation, a signed inbound owner reply, replay
 * handling and session isolation, with the mail provider stubbed.
 */
import assert from "node:assert/strict";
import { Webhook } from "svix";
import { createHarness } from "./qa-harness.mjs";

const inboundId = "12345678-1234-1234-1234-123456789012";
const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;

process.env.SUPPORT_EMAIL = "owner@example.test";
process.env.SUPPORT_INBOUND_DOMAIN = "inbound.example.test";
process.env.RESEND_INBOUND_API_KEY = "fixture";
process.env.RESEND_WEBHOOK_SECRET = secret;
process.env.RESEND_API_KEY = "fixture";

const harness = await createHarness({ name: "support-conversation" });
const { db, load } = harness;

let sent = null;
let ownerReplyAddress = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  if (target === "https://api.resend.com/emails" && init.method === "POST") {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "fixture" }), { status: 200 });
  }
  if (target.includes("/emails/receiving/")) {
    return new Response(
      JSON.stringify({
        from: "Owner <owner@example.test>",
        to: [ownerReplyAddress],
        text: "Hello, we can help!",
        authentication: { dmarc: "pass" },
      }),
      { status: 200 }
    );
  }
  return realFetch(url, init);
};

const support = await load("/app/api/support/route.ts");
const inbound = await load("/app/api/support/inbound/route.ts");

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const created = await support.POST(
    new Request("https://example.test/api/support", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: JSON.stringify({ name: "Test customer", email: "buyer@example.test", message: "Can you help with my design?" }),
    })
  );
  check("a support conversation is created", created.status === 200);
  check("the owner gets a reply address", /^kcp-[a-f0-9]{48}@inbound\.example\.test$/.test(sent?.reply_to ?? ""));
  ownerReplyAddress = sent.reply_to;
  const customerToken = (created.headers.get("set-cookie") ?? "").match(/kcp_support=([a-f0-9]{64})/)?.[1];
  check("the customer session cookie is set", Boolean(customerToken));

  const payload = JSON.stringify({ type: "email.received", data: { email_id: inboundId } });
  const at = new Date();
  const id = "msg_fixture";
  const signature = new Webhook(secret).sign(id, at, payload);
  const makeInbound = () =>
    new Request("https://example.test/api/support/inbound", {
      method: "POST",
      headers: {
        "svix-id": id,
        "svix-timestamp": String(Math.floor(at.getTime() / 1000)),
        "svix-signature": signature,
      },
      body: payload,
    });

  check("a signed owner reply is accepted", (await inbound.POST(makeInbound())).status === 200);
  check("the reply is sent to the customer", sent?.to?.[0] === "buyer@example.test");
  check("the follow-up email gets a reply address", /^kcp-[a-f0-9]{48}@inbound\.example\.test$/.test(sent?.reply_to ?? ""));

  check("a replayed event is accepted", (await inbound.POST(makeInbound())).status === 200);

  const viewed = await support.GET(
    new Request("https://example.test/api/support", { headers: { cookie: `kcp_support=${customerToken}` } })
  );
  const body = await viewed.json();
  check("the conversation shows both messages", body.messages.length === 2);
  check("the owner reply is visible", body.messages[1]?.body === "Hello, we can help!");

  const stranger = await support.GET(
    new Request("https://example.test/api/support", { headers: { cookie: `kcp_support=${"f".repeat(64)}` } })
  );
  const strangerBody = await stranger.json();
  check("another session cannot read the conversation", strangerBody.messages.length === 0);

  const stored = db.prepare("SELECT * FROM support_messages").all();
  check("the replayed event stored one owner reply", stored.length === 2);

  const unauthenticated = await support.POST(
    new Request("https://example.test/api/support", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ name: "Test customer", email: "buyer@example.test", message: "Hi" }),
    })
  );
  check("a cross-origin support message is refused", unauthenticated.status === 403);

  const invalidSignature = await inbound.POST(
    new Request("https://example.test/api/support/inbound", {
      method: "POST",
      headers: { "svix-id": id, "svix-timestamp": String(Math.floor(at.getTime() / 1000)), "svix-signature": "v1,bad" },
      body: payload,
    })
  );
  check("an unsigned inbound event is refused", invalidSignature.status === 400);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  globalThis.fetch = realFetch;
  await harness.close();
}

console.log(failures ? `\n${failures} support conversation check(s) failed` : "\nall support conversation checks passed");
process.exit(failures ? 1 : 0);
