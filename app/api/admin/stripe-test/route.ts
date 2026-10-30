import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "../_guard";
import { siteUrl, stripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";
const cookieName = "kcp_stripe_test";

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let body: { action?: string; session?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    const stripe = await stripeClient();
    if (!stripe) return NextResponse.json({ error: "Live Stripe credentials are not configured." }, { status: 503 });
    if (body.action === "start") {
      const base = siteUrl();
      const session = await stripe.checkout.sessions.create({
        mode: "payment", payment_method_types: ["card"],
        metadata: { purpose: "kcp-admin-one-dollar-test" },
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 100, product_data: { name: "Kingdom Custom Print $1 test — no merchandise" } } }],
        success_url: `${base}/admin/stripe-test?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/admin/stripe-test?cancelled=1`,
      }, { idempotencyKey: `stripe-test-${randomUUID()}` });
      if (!session.livemode || !session.url || new URL(session.url).hostname !== "checkout.stripe.com" || !/^cs_live_[A-Za-z0-9]+$/.test(session.id)) throw new Error("Unexpected checkout response");
      const res = NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
      res.cookies.set(cookieName, session.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86400 });
      return res;
    }
    const cookie = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const id = typeof body.session === "string" ? body.session : "";
    if (!/^cs_live_[A-Za-z0-9]+$/.test(id) || cookie !== id) return NextResponse.json({ error: "Test session does not match this browser. Return to the original browser and sign in again." }, { status: 400 });
    if (body.action !== "status" && body.action !== "refund") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    const session = await stripe.checkout.sessions.retrieve(id);
    if (!session.livemode || session.metadata?.purpose !== "kcp-admin-one-dollar-test" || session.currency !== "usd" || session.amount_total !== 100) throw new Error("Not a $1 live test session");
    const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (session.payment_status !== "paid" || !intent) {
      if (body.action === "refund") return NextResponse.json({ error: "This test has not been paid, so there is nothing to refund." }, { status: 409 });
      return NextResponse.json({ paymentStatus: session.payment_status }, { headers: { "Cache-Control": "no-store" } });
    }
    const existing = await stripe.refunds.list({ payment_intent: intent, limit: 100 });
    const prior = existing.data.find((refund) => refund.status !== "failed" && refund.status !== "canceled");
    if (body.action === "refund" && !prior) {
      const refund = await stripe.refunds.create({ payment_intent: intent, amount: 100 }, { idempotencyKey: `test-refund-${id}` });
      return NextResponse.json({ paymentStatus: session.payment_status, refundStatus: refund.status ?? "unknown" }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ paymentStatus: session.payment_status, refundStatus: prior?.status ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const rawCode = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : null;
    const code = typeof rawCode === "string" && /^[a-z0-9_]{1,100}$/i.test(rawCode) ? ` Stripe code: ${rawCode}.` : "";
    return NextResponse.json({ error: `Stripe could not complete this step.${code} Check the Stripe dashboard before trying again.` }, { status: 502 });
  }
}
