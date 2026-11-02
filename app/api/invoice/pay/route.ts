import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { sameOrigin, authAttemptAllowed } from "@/lib/customer-auth";
import { paypalConfigured, paypalRequest } from "@/lib/paypal";
import { paymentsConfigured, siteUrl, stripeClient } from "@/lib/stripe";
import { attachInvoiceCheckout, closeStripeInvoiceSession, InvoicePaymentError, recordStripeInvoicePayment, reserveInvoicePayment } from "@/lib/invoice-payments";
import { limitedJson } from "@/lib/limited-form-data";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (!(await authAttemptAllowed(req, "__invoice_pay__"))) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  let body: { token?: unknown; provider?: unknown }; try { body = await limitedJson(req, 4096) as typeof body; } catch (error) { return NextResponse.json({ error: error instanceof RangeError ? "Request is too large." : "Invalid request." }, { status: error instanceof RangeError ? 413 : 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || (body.provider !== "stripe" && body.provider !== "paypal")) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const provider = body.provider;
  try {
    if (!(provider === "stripe" ? await paymentsConfigured() : await paypalConfigured())) return NextResponse.json({ error: "This payment method is currently unavailable." }, { status: 503 });
    const hash = createHash("sha256").update(token).digest("hex");
    let { invoice, attempt } = await reserveInvoicePayment(hash, provider);
    const stripe = provider === "stripe" ? await stripeClient() : null;
    if (provider === "stripe" && !stripe) throw new Error("Stripe unavailable");
    if (provider === "stripe" && stripe && attempt.provider_id) {
      const session = await stripe.checkout.sessions.retrieve(attempt.provider_id);
      if (session.payment_status === "paid") { await recordStripeInvoicePayment(session); return NextResponse.json({ error: "This invoice has already been paid." }, { status: 409 }); }
      if (session.status === "expired") {
        await closeStripeInvoiceSession(session);
        ({ invoice, attempt } = await reserveInvoicePayment(hash, provider));
      } else if (session.status !== "open") return NextResponse.json({ error: "Your payment is being confirmed. Please check again shortly." }, { status: 409 });
    }
    if (attempt.checkout_url && attempt.state === "open") return NextResponse.json({ url: attempt.checkout_url });
    const base = siteUrl();
    if (provider === "paypal") {
      const result = await paypalRequest<{ id?: string; links?: { rel: string; href: string }[] }>("/v2/checkout/orders", {
        method: "POST", requestId: `i-${attempt.id.replaceAll("-", "")}`,
        body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ custom_id: `invoice-${attempt.id}`, amount: { currency_code: "USD", value: (Number(attempt.amount_cents) / 100).toFixed(2) } }], payment_source: { paypal: { experience_context: { return_url: `${base}/api/invoice/paypal-return`, cancel_url: `${base}/invoice/payment-result?cancelled=1`, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } } } }),
      });
      const approval = result.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
      if (!result.id || !/^[A-Z0-9]{1,20}$/.test(result.id) || !approval || !/^https:\/\/(www\.)?paypal\.com\//i.test(approval)) throw new Error("Invalid PayPal response");
      const saved = await attachInvoiceCheckout(attempt.id, result.id, approval);
      if (saved.state !== "open") return NextResponse.json({ error: "This payment is no longer available. Please refresh the invoice." }, { status: 409 });
      return NextResponse.json({ url: approval });
    }
    if (!stripe) throw new Error("Stripe unavailable");
    const session = await stripe.checkout.sessions.create({ mode: "payment", payment_method_types: ["card"], customer_email: invoice.customer_email || undefined, metadata: { invoiceAttemptId: attempt.id }, line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Number(attempt.amount_cents), product_data: { name: `Kingdom Custom Print invoice #${invoice.id}` } } }], success_url: `${base}/invoice/payment-result`, cancel_url: `${base}/invoice/payment-result?cancelled=1` }, { idempotencyKey: `invoice-${attempt.id}` });
    if (!session.url || !/^https:\/\/checkout\.stripe\.com\//i.test(session.url)) throw new Error("Invalid Stripe response");
    const saved = await attachInvoiceCheckout(attempt.id, session.id, session.url);
    if (saved.state !== "open") return NextResponse.json({ error: "This payment is no longer available. Please refresh the invoice." }, { status: 409 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof InvoicePaymentError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "We could not start payment. Please try again or contact us." }, { status: 503 });
  }
}
