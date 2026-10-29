import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { markOrderPaid } from "@/lib/orders";
import { stripeClient } from "@/lib/stripe";
import { sendPaidOrderReceipt } from "@/lib/order-email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    // Signature verification must run against the raw body.
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status !== "paid") break;
      const order = await markOrderPaid(
        session.id,
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
        event.id
      );
      if (order) {
        try {
          await sendPaidOrderReceipt(order.reference);
        } catch {
          // Stripe retries the event, allowing delivery to recover without
          // rolling back the already confirmed payment.
          return NextResponse.json({ error: "Order receipt delivery failed; retry the event." }, { status: 503 });
        }
      }
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object;
      if (session.client_reference_id) {
        const { cancelOrder } = await import("@/lib/orders");
        await cancelOrder(session.client_reference_id, { eventId: event.id });
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      if (session.client_reference_id) {
        const { cancelOrder } = await import("@/lib/orders");
        await cancelOrder(session.client_reference_id, {
          eventId: event.id,
          note: "Stripe reported that the asynchronous payment failed.",
        });
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      if (charge.amount_refunded < charge.amount) break;
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
      if (paymentIntentId) {
        const { markOrderRefunded } = await import("@/lib/orders");
        await markOrderRefunded(paymentIntentId, event.id);
      }
      break;
    }
    default:
      // Other event types are not acted on; acknowledging keeps Stripe from retrying.
      break;
  }

  return NextResponse.json({ received: true });
}
