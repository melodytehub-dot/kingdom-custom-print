import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authAttemptAllowed, sameOrigin } from "@/lib/customer-auth";
import { emailConfigured, sendEmail } from "@/lib/email";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
const cookieName = "kcp_support";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function tokenFrom(request: Request) {
  const token = (request.headers.get("cookie") ?? "").split(";").map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? "";
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}

export async function GET(request: Request) {
  const token = tokenFrom(request);
  const available = Boolean(process.env.SUPPORT_EMAIL?.trim() && process.env.SUPPORT_INBOUND_DOMAIN?.trim() && process.env.RESEND_INBOUND_API_KEY && process.env.RESEND_WEBHOOK_SECRET && emailConfigured());
  if (!token) return NextResponse.json({ messages: [], available }, { headers: { "Cache-Control": "no-store" } });
  const [conversation] = await sql<{ id: string }[]>`SELECT id FROM support_conversations WHERE customer_token_hash = ${hash(token)} AND expires_at > now() LIMIT 1`;
  if (!conversation) {
    const response = NextResponse.json({ messages: [], available }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  }
  const messages = await sql<{ sender: string; body: string; created_at: Date }[]>`SELECT sender, body, created_at FROM support_messages WHERE conversation_id = ${conversation.id} ORDER BY id ASC LIMIT 200`;
  return NextResponse.json({ messages, available }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  const destination = process.env.SUPPORT_EMAIL?.trim();
  const inboundDomain = process.env.SUPPORT_INBOUND_DOMAIN?.trim().toLowerCase();
  if (!destination || !inboundDomain || !/^[a-z0-9.-]+$/.test(inboundDomain) || !process.env.RESEND_INBOUND_API_KEY || !process.env.RESEND_WEBHOOK_SECRET || !emailConfigured()) return NextResponse.json({ error: "Messaging is temporarily unavailable." }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 16000) return NextResponse.json({ error: "Message is too long." }, { status: 413 });
  let input: { name?: unknown; email?: unknown; message?: unknown };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const message = String(input.message ?? "").trim();
  const existing = tokenFrom(request);
  if (message.length < 1 || message.length > 4000 || (!existing && (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)))) return NextResponse.json({ error: "Check your name, email and message." }, { status: 422 });
  try {
    if (!await authAttemptAllowed(request, "__support_message__")) return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
    const customerToken = existing || randomBytes(32).toString("hex");
    let conversation = existing ? (await sql<{ id: string; name: string; email: string }[]>`SELECT id, name, email FROM support_conversations WHERE customer_token_hash = ${hash(existing)} AND expires_at > now() LIMIT 1`)[0] : undefined;
    if (existing && !conversation) return NextResponse.json({ error: "This conversation has expired." }, { status: 410 });
    if (!conversation) [conversation] = await sql<{ id: string; name: string; email: string }[]>`INSERT INTO support_conversations (customer_token_hash, name, email) VALUES (${hash(customerToken)}, ${name}, ${email}) RETURNING id, name, email`;
    const replyToken = randomBytes(24).toString("hex");
    await sql`INSERT INTO support_reply_tokens (token_hash, conversation_id) VALUES (${hash(replyToken)}, ${conversation.id})`;
    await sendEmail({ to: destination, replyTo: `kcp-${replyToken}@${inboundDomain}`, subject: "New customer support message", text: `From: ${conversation.name}\nCustomer email: ${conversation.email}\n\n${message}\n\nReply to this email to respond in the customer's conversation.` });
    await sql`INSERT INTO support_messages (conversation_id, sender, body) VALUES (${conversation.id}, 'customer', ${message})`;
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(cookieName, customerToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 90 * 86400 });
    return response;
  } catch { return NextResponse.json({ error: "Could not send your message. Please try again." }, { status: 503 }); }
}
