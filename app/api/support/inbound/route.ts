import { createHash } from "node:crypto";
import { Webhook } from "svix";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_INBOUND_API_KEY;
  const domain = process.env.SUPPORT_INBOUND_DOMAIN?.trim().toLowerCase();
  const owner = process.env.SUPPORT_EMAIL?.trim().toLowerCase();
  if (!secret || !apiKey || !domain || !owner) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const body = await request.text();
  if (body.length > 100000) return NextResponse.json({ error: "Too large" }, { status: 413 });
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
    if (sender !== owner || mail.authentication?.dmarc?.toLowerCase() !== "pass") return NextResponse.json({ ok: true });
    const recipient = (mail.to ?? []).map(x => x.toLowerCase()).find(x => x.endsWith(`@${domain}`));
    const token = recipient?.match(/^kcp-([a-f0-9]{48})@/)?.[1];
    if (!token) return NextResponse.json({ ok: true });
    const text = (mail.text ?? "").split(/\n(?:On .+ wrote:|>\s|--\s*$)/m)[0].trim().slice(0, 4000);
    if (!text) return NextResponse.json({ ok: true });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await sql`INSERT INTO support_messages (conversation_id, sender, body, provider_event_id) SELECT t.conversation_id, 'business', ${text}, ${emailId} FROM support_reply_tokens t JOIN support_conversations c ON c.id = t.conversation_id WHERE t.token_hash = ${tokenHash} AND c.expires_at > now() ON CONFLICT (provider_event_id) DO NOTHING`;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Temporary failure" }, { status: 503 }); }
}
