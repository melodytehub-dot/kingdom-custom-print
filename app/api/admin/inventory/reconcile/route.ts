import { NextResponse } from "next/server";
import { requireAdmin } from "../../_guard";
import { authAttemptAllowed } from "@/lib/customer-auth";
import { sql } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";
import { paypalRequest } from "@/lib/paypal";
import { cancelOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  try {
    const rows = await sql`SELECT o.reference, o.status, o.created_at, CASE WHEN o.stripe_session_id IS NOT NULL THEN 'stripe' WHEN o.paypal_order_id IS NOT NULL THEN 'paypal' ELSE 'unknown' END AS provider FROM orders o WHERE (o.status = 'pending' AND EXISTS (SELECT 1 FROM inventory_reservations r WHERE r.order_id = o.id)) OR (o.status = 'cancelled' AND NOT o.inventory_provider_closed AND (o.stripe_session_id IS NOT NULL OR o.paypal_order_id IS NOT NULL)) ORDER BY o.created_at DESC LIMIT 100`;
    return NextResponse.json({ orders: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Payment holds are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!(await authAttemptAllowed(req, "__inventory_reconcile__"))) return NextResponse.json({ error: "Too many checks. Try again later." }, { status: 429 });
  let body: { reference?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const reference = typeof body?.reference === "string" ? body.reference.trim().toUpperCase() : "";
  if (!/^KCP-[A-Z2-9]{6}$/.test(reference)) return NextResponse.json({ error: "Invalid order reference." }, { status: 422 });
  const [order] = await sql<{ status: string; stripe_session_id: string | null; paypal_order_id: string | null }[]>`SELECT status, stripe_session_id, paypal_order_id FROM orders WHERE reference = ${reference} LIMIT 1`;
  if (!order || !["pending", "cancelled"].includes(order.status)) return NextResponse.json({ error: "This order no longer needs a payment check." }, { status: 409 });
  try {
    let confirmed = false;
    if (order.stripe_session_id) {
      const stripe = await stripeClient();
      if (!stripe) return NextResponse.json({ error: "Card payments are unavailable for this check." }, { status: 503 });
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      confirmed = session.status === "expired" && session.payment_status !== "paid";
    } else if (order.paypal_order_id && /^[A-Z0-9]{1,20}$/.test(order.paypal_order_id)) {
      const paypal = await paypalRequest<{ status?: string }>(`/v2/checkout/orders/${order.paypal_order_id}`);
      confirmed = paypal.status === "VOIDED";
    }
    if (!confirmed) return NextResponse.json({ error: "The provider has not confirmed this payment is closed. Stock remains held; check the order again later." }, { status: 409 });
    const closed = await cancelOrder(reference, { actor: "system", providerClosed: true, stripeSessionId: order.stripe_session_id ?? undefined, paypalOrderId: order.paypal_order_id ?? undefined, note: "Payment provider confirmed that checkout is closed." });
    if (!closed) return NextResponse.json({ error: "The order changed during this check. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not verify the payment with its provider. Stock remains held." }, { status: 503 }); }
}
