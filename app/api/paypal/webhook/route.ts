import { NextResponse } from "next/server";
import { paypalConfigured, paypalRequest } from "@/lib/paypal";
import { getPaymentCredential } from "@/lib/payment-credentials";
import { capturePayPalOrder } from "@/lib/paypal-capture";
import { recordPayPalCapture, markPayPalRefunded } from "@/lib/orders";
import { sendPaidOrderReceipt } from "@/lib/order-email";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!(await paypalConfigured())) return NextResponse.json({ error: "PayPal is not configured." }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "Event too large." }, { status: 413 });
  let event: { id?: string; event_type?: string; resource?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string }; supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } } } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid event." }, { status: 400 }); }
  const keys = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"] as const;
  const values = keys.map((key) => request.headers.get(key));
  if (values.some((value) => !value)) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  try {
    const fields = { auth_algo: values[0], cert_url: values[1], transmission_id: values[2], transmission_sig: values[3], transmission_time: values[4], webhook_id: await getPaymentCredential("PAYPAL_WEBHOOK_ID") };
    const verification = await paypalRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", { method: "POST", body: `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${raw}}` });
    if (verification.verification_status !== "SUCCESS") return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    const resource = event.resource;
    if (event.event_type === "CHECKOUT.ORDER.APPROVED" && resource?.id) await capturePayPalOrder(resource.id);
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" && resource?.id && resource.amount?.value && resource.amount.currency_code && resource.supplementary_data?.related_ids?.order_id) {
      const paid = await recordPayPalCapture(resource.supplementary_data.related_ids.order_id, resource.id, resource.amount.value, resource.amount.currency_code, event.id);
      if (paid) await sendPaidOrderReceipt(paid.reference);
    }
    if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      const captureId = resource?.supplementary_data?.related_ids?.capture_id;
      if (captureId && /^[A-Z0-9]{1,20}$/.test(captureId)) {
        const capture = await paypalRequest<{ status?: string }>(`/v2/payments/captures/${captureId}`);
        if (capture.status === "REFUNDED") await markPayPalRefunded(captureId, event.id);
      }
    }
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "PayPal event processing failed." }, { status: 503 }); }
}
