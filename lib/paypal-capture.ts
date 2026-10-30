import { paypalRequest } from "./paypal";
import { paypalOrderForCapture, recordPayPalCapture } from "./orders";
import { sendPaidOrderReceipt } from "./order-email";

type PayPalOrder = { status?: string; purchase_units?: { payments?: { captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] };

export async function capturePayPalOrder(id: string): Promise<string | null> {
  if (!/^[A-Z0-9]{1,20}$/.test(id)) return null;
  const existing = await paypalOrderForCapture(id);
  if (!existing) return null;
  let result: PayPalOrder;
  if (existing.status === "pending") {
    try {
      result = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${id}/capture`, { method: "POST", body: "{}", requestId: `capture-${id}` });
    } catch {
      // A concurrent webhook/redirect may already have captured the order.
      result = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${id}`);
    }
  } else result = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${id}`);
  const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
  if (result.status === "APPROVED") throw new Error("PayPal capture has not completed; retry.");
  if (result.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id || !capture.amount?.value || !capture.amount.currency_code) return existing.reference;
  const paid = await recordPayPalCapture(id, capture.id, capture.amount.value, capture.amount.currency_code);
  if (!paid) throw new Error("PayPal payment did not match the order.");
  await sendPaidOrderReceipt(paid.reference);
  return paid.reference;
}
