import { createHash, createHmac } from "node:crypto";
import { Webhook } from "svix";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { limitedText } from "@/lib/limited-form-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_INBOUND_API_KEY;
  const domain = process.env.SUPPORT_INBOUND_DOMAIN?.trim().toLowerCase();
  const owner = process.env.SUPPORT_EMAIL?.trim().toLowerCase();
  if (!secret || !apiKey || !domain || !owner) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  let body: string;
  try { body = await limitedText(request, 100_000); }
  catch (error) { return NextResponse.json({ error: "Invalid event" }, { status: error instanceof RangeError ? 413 : 400 }); }
  const id = request.headers.get("svix-id"), timestamp = request.headers.get("svix-timestamp"), signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  type ReceivedEvent = { type?: string; data?: { email_id?: string } };
  let event: ReceivedEvent;
  try {
    new Webhook(secret).verify(body, { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature });
    event = JSON.parse(body) as ReceivedEvent;
  }
  catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
  if (event.type !== "email.received") return NextResponse.json({ ok: true });
  const emailId = event.data?.email_id;
  if (!emailId || !/^[a-f0-9-]{36}$/i.test(emailId)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  try {
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Inbound retrieval failed");
    const mail = await response.json() as { from?: string; to?: string[]; text?: string | null; authentication?: { dmarc?: string } };
    const sender = (mail.from ?? "").match(/<?([^<>\s]+@[^<>\s]+)>?$/)?.[1]?.toLowerCase();
    if (!sender || mail.authentication?.dmarc?.toLowerCase() !== "pass") return NextResponse.json({ ok: true });
    const recipient = (mail.to ?? []).map(x => x.toLowerCase()).find(x => x.endsWith(`@${domain}`));
    const token = recipient?.match(/^kcp-([a-f0-9]{48})@/)?.[1];
    if (!token) return NextResponse.json({ ok: true });
    // Gmail may wrap its attribution across multiple lines, including the
    // sender address. Stop there before displaying the quoted conversation.
    // Only strip signatures with the standard delimiter: a name or initials
    // without one may be an intentional part of the owner's reply.
    const text = (mail.text ?? "")
      .replace(/\r\n?/g, "\n")
      .split(/(?:^|\n)(?:On [^\n]*(?:\n[^\n]*){0,3}?\s+wrote:\s*(?=\n|$)|[ \t]*>.*|--[ \t]+$)/im)[0]
      .trim().slice(0, 4000);
    if (!text) return NextResponse.json({ ok: true });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [conversation] = await sql<{ id: string; name: string; email: string; audience: "owner" | "customer" }[]>`SELECT c.id::text, c.name, c.email, t.audience FROM support_reply_tokens t JOIN support_conversations c ON c.id = t.conversation_id WHERE t.token_hash = ${tokenHash} AND c.expires_at > now()`;
    if (!conversation) return NextResponse.json({ ok: true });
    const isOwner = conversation.audience === "owner" && sender === owner;
    const isCustomer = conversation.audience === "customer" && sender === conversation.email.toLowerCase();
    if (!isOwner && !isCustomer) return NextResponse.json({ ok: true });
    const role = isOwner ? "business" : "customer";
    const audience = isOwner ? "customer" : "owner";
    // Keep the reply address and email identical when Resend retries the event.
    const nextToken = createHmac("sha256", secret).update(`support-reply:${emailId}:${audience}`).digest("hex").slice(0, 48);
    const nextHash = createHash("sha256").update(nextToken).digest("hex");
    await sql`INSERT INTO support_reply_tokens (token_hash, conversation_id, audience) VALUES (${nextHash}, ${conversation.id}::bigint, ${audience}) ON CONFLICT (token_hash) DO NOTHING`;
    await sql`INSERT INTO support_messages (conversation_id, sender, body, provider_event_id) VALUES (${conversation.id}::bigint, ${role}, ${text}, ${emailId}) ON CONFLICT (provider_event_id) DO NOTHING`;
    await sendEmail({ to: isOwner ? conversation.email : owner, replyTo: `kcp-${nextToken}@${domain}`, subject: isOwner ? "A reply from Kingdom Custom Print" : "Customer support reply", text: isOwner ? `Hi ${conversation.name},\n\n${text}\n\nReply to this email to continue the conversation.` : `From: ${conversation.name}\nCustomer email: ${conversation.email}\n\n${text}\n\nReply to this email to continue the conversation.`, idempotencyKey: `support-reply-${emailId}` });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Temporary failure" }, { status: 503 }); }
}
