import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { getPaymentCredential } from "@/lib/payment-credentials";
import { stripeClient } from "@/lib/stripe";
import { paypalRequest } from "@/lib/paypal";

export const dynamic = "force-dynamic";

/** Read-only provider checks; no credentials or provider response data are returned. */
export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const result = {
    stripe: "unavailable",
    paypal: "unavailable",
    paypalWebhook: "unavailable",
    stripeWebhook: "not verified",
  };
  try {
    const stripe = await stripeClient();
    if (stripe) {
      await stripe.checkout.sessions.list({ limit: 1 });
      result.stripe = "connected";
      try {
        const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
        const endpoint = endpoints.data.find((entry) => entry.url === "https://kingdomcustomprint.com/api/webhook" && entry.status === "enabled");
        const required = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "charge.refunded"];
        result.stripeWebhook = !endpoint ? "expected active endpoint not found" :
          !endpoint.enabled_events.includes("*") && required.some((event) => !endpoint.enabled_events.includes(event as typeof endpoint.enabled_events[number])) ? "required events missing" : "configured (delivery unverified)";
      } catch {
        result.stripeWebhook = "cannot inspect with current key";
      }
    }
  } catch {
    result.stripe = "authentication or checkout permission failed";
  }

  try {
    // Listing webhooks authenticates with the live PayPal API without altering the account.
    const hooks = await paypalRequest<{ webhooks?: { id?: string; url?: string; event_types?: { name?: string }[] }[] }>("/v1/notifications/webhooks");
    result.paypal = "connected";
    const id = await getPaymentCredential("PAYPAL_WEBHOOK_ID");
    const hook = hooks.webhooks?.find((item) => item.id === id);
    const required = ["CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED"];
    const events = new Set(hook?.event_types?.map((event) => event.name));
    result.paypalWebhook = !hook ? "saved webhook not found" :
      hook.url !== "https://kingdomcustomprint.com/api/paypal/webhook" ? "incorrect endpoint" :
      !events.has("*") && required.some((event) => !events.has(event)) ? "required events missing" : "configured (delivery unverified)";
  } catch {
    result.paypal = "authentication or webhook access failed";
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
