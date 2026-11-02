import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { passwordMatches } from "@/lib/admin-auth";
import { authAttemptAllowed, sameOrigin } from "@/lib/customer-auth";
import { sql } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";
import { paypalRequest } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (!(await authAttemptAllowed(req, "__invoice_refund__"))) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  let body: { id?: unknown; password?: unknown }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.password !== "string" || !passwordMatches(body.password)) return NextResponse.json({ error: "The admin password is incorrect." }, { status: 403 });
  const id = String(body.id ?? ""); if (!/^[1-9][0-9]{0,15}$/.test(id)) return NextResponse.json({ error: "Invoice not found." }, { status: 422 });
  const [payment] = await sql<{ id: string; provider: string; payment_id: string | null }[]>`SELECT id::text, provider, payment_id FROM invoice_payment_attempts WHERE quote_id = ${id}::bigint AND state = 'paid' LIMIT 1`;
  if (!payment?.payment_id) return NextResponse.json({ error: "This invoice has no refundable payment." }, { status: 409 });
  try {
    if (payment.provider === "paypal") {
      if (!/^[A-Z0-9]{1,20}$/.test(payment.payment_id)) throw new Error("Invalid capture");
      const refund = await paypalRequest<{ status?: string }>(`/v2/payments/captures/${payment.payment_id}/refund`, { method: "POST", body: "{}", requestId: `invoice-refund-${payment.payment_id}` });
      if (refund.status !== "COMPLETED" && refund.status !== "PENDING") throw new Error("Refund unavailable");
    } else {
      const stripe = await stripeClient(); if (!stripe) throw new Error("Stripe unavailable");
      const refund = await stripe.refunds.create({ payment_intent: payment.payment_id }, { idempotencyKey: `invoice-refund-${payment.id}` });
      if (refund.status === "failed" || refund.status === "canceled") throw new Error("Refund unavailable");
    }
    return NextResponse.json({ ok: true, message: "Refund submitted. The invoice will update when the payment provider confirms it." });
  } catch { return NextResponse.json({ error: "The refund could not be confirmed. Check the payment provider before trying again." }, { status: 502 }); }
}
