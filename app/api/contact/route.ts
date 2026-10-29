import { NextResponse } from "next/server";
import { authAttemptAllowed, sameOrigin } from "@/lib/customer-auth";
import { emailConfigured, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const destination = process.env.SUPPORT_EMAIL?.trim();
  if (!emailConfigured() || !destination) return NextResponse.json({ error: "Contact email is temporarily unavailable." }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 16000) return NextResponse.json({ error: "Message is too long." }, { status: 413 });
  let input: { name?: unknown; email?: unknown; message?: unknown; orderReference?: unknown };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim();
  const message = String(input.message ?? "").trim();
  const reference = String(input.orderReference ?? "").trim();
  if (name.length < 2 || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || message.length < 10 || message.length > 8000 || reference.length > 80) {
    return NextResponse.json({ error: "Check your name, email and message." }, { status: 422 });
  }
  try {
    if (!await authAttemptAllowed(request, "__contact_form__")) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    await sendEmail({
      to: destination,
      replyTo: email,
      subject: "Kingdom Custom Print contact request",
      text: `Name: ${name}\nEmail: ${email}\n${reference ? `Order reference: ${reference}\n` : ""}\n${message}`,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not send your message. Please try again later." }, { status: 503 });
  }
}
