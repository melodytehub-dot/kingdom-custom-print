import { sql } from "./db";
import { sendEmail } from "./email";
import { getOrderByReference } from "./orders";
import { publicSiteUrl } from "./site-url";

/** Webhook retries are safe: Resend and our database both record the receipt. */
export async function sendPaidOrderReceipt(reference: string): Promise<void> {
  const [sent] = await sql<{ reference: string }[]>`SELECT reference FROM order_email_receipts WHERE reference = ${reference}`;
  if (sent) return;
  const order = await getOrderByReference(reference);
  if (!order || !["paid", "in_proof", "in_production", "shipped"].includes(order.status)) return;
  const lines = order.items.map((item) => `${item.quantity} × ${item.productName} (${item.colorName})`);
  const providerId = await sendEmail({
    to: order.email,
    subject: `Your Kingdom Custom Print order ${reference}`,
    text: `Hi ${order.name},\n\nThank you for your order. Your payment has been received.\n\nOrder: ${reference}\n${lines.join("\n")}\nTotal: $${order.total.toFixed(2)}\n\nCheck your order: ${publicSiteUrl()}/track\n\nKingdom Custom Print`,
    action: { label: "Track your order", url: `${publicSiteUrl()}/track` },
    idempotencyKey: `order-receipt/${reference}`,
  });
  await sql`INSERT INTO order_email_receipts (reference, provider_id) VALUES (${reference}, ${providerId}) ON CONFLICT (reference) DO NOTHING`;
}
