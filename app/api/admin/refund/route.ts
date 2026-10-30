import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { passwordMatches } from "@/lib/admin-auth";
import { sameOrigin, authAttemptAllowed } from "@/lib/customer-auth";
import { sql } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";
import { paypalRequest } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!(await authAttemptAllowed(req, "__refund__"))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  let body: { reference?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.password !== "string" || !passwordMatches(body.password)) return NextResponse.json({ error: "The admin password is incorrect." }, { status: 403 });
  const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
  if (!/^KCP-[A-Z2-9]{6}$/.test(reference)) return NextResponse.json({ error: "Invalid order reference." }, { status: 422 });
  const [order] = await sql<{ stripe_payment_intent: string | null; paypal_capture_id: string | null; status: string; paid_at: Date | null }[]>`SELECT stripe_payment_intent, paypal_capture_id, status, paid_at FROM orders WHERE reference = ${reference} LIMIT 1`;
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.paid_at || (!order.stripe_payment_intent && !order.paypal_capture_id) || order.status === "refunded") return NextResponse.json({ error: "This order cannot be refunded." }, { status: 409 });
  if (order.paypal_capture_id) {
    try {
      if (!/^[A-Z0-9]{1,20}$/.test(order.paypal_capture_id)) throw new Error("Invalid capture ID.");
      const refund = await paypalRequest<{ status?: string }>(`/v2/payments/captures/${order.paypal_capture_id}/refund`, { method: "POST", body: "{}", requestId: `refund-${order.paypal_capture_id}` });
      if (refund.status !== "COMPLETED" && refund.status !== "PENDING") throw new Error("Refund rejected.");
      return NextResponse.json({ ok: true, status: refund.status, message: "Refund submitted to PayPal. The order will update after PayPal confirms it." });
    } catch { return NextResponse.json({ error: "PayPal could not process the refund. Check the PayPal dashboard before trying again." }, { status: 502 }); }
  }
  if (!order.stripe_payment_intent) return NextResponse.json({ error: "No Stripe payment is associated with this order." }, { status: 409 });
  const stripe = await stripeClient();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  try {
    const refund = await stripe.refunds.create({ payment_intent: order.stripe_payment_intent }, { idempotencyKey: `full-refund-${reference}` });
    if (refund.status === "failed" || refund.status === "canceled") return NextResponse.json({ error: "Stripe could not complete the refund. Check the Stripe dashboard." }, { status: 502 });
    return NextResponse.json({ ok: true, status: refund.status, message: "Refund submitted to Stripe. The order will update after Stripe confirms it." });
  } catch {
    return NextResponse.json({ error: "Stripe could not process the refund. Check the Stripe dashboard before trying again." }, { status: 502 });
  }
}
