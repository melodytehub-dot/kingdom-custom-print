import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { passwordMatches } from "@/lib/admin-auth";
import { authAttemptAllowed, sameOrigin } from "@/lib/customer-auth";
import { PAYMENT_FIELDS, paymentCredentialStatus, paymentVaultConfigured, savePaymentCredentials, type PaymentField } from "@/lib/payment-credentials";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ available: paymentVaultConfigured(), fields: await paymentCredentialStatus() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!paymentVaultConfigured()) return NextResponse.json({ error: "Secure payment storage is not configured." }, { status: 503 });
  if (!(await authAttemptAllowed(req, "__payment_settings__"))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  let body: { password?: unknown; fields?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.password !== "string" || !passwordMatches(body.password)) return NextResponse.json({ error: "The admin password is incorrect." }, { status: 403 });
  if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) return NextResponse.json({ error: "No payment credentials supplied." }, { status: 400 });
  const values: Partial<Record<PaymentField, string>> = {};
  for (const name of PAYMENT_FIELDS) {
    const v = (body.fields as Record<string, unknown>)[name];
    if (v === undefined || v === "") continue;
    if (typeof v !== "string" || v.trim().length < 8 || v.trim().length > 512 || /\s/.test(v.trim())) return NextResponse.json({ error: `Check the ${name.replaceAll("_", " ")} value.` }, { status: 422 });
    values[name] = v.trim();
  }
  if (!Object.keys(values).length) return NextResponse.json({ error: "Enter at least one credential." }, { status: 422 });
  if (values.STRIPE_SECRET_KEY && !/^(sk|rk)_live_/.test(values.STRIPE_SECRET_KEY)) return NextResponse.json({ error: "Enter a live Stripe secret or restricted key." }, { status: 422 });
  if (values.STRIPE_WEBHOOK_SECRET && !values.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) return NextResponse.json({ error: "Enter a Stripe webhook signing secret." }, { status: 422 });
  await savePaymentCredentials(values);
  return NextResponse.json({ ok: true, fields: await paymentCredentialStatus() }, { headers: { "Cache-Control": "no-store" } });
}
