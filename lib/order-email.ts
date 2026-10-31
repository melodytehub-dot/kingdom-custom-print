import { sql } from "./db";
import { sendEmail } from "./email";
import { getOrderByReference } from "./orders";

/** Webhook retries are safe: Resend and our database both record the receipt. */
export async function sendPaidOrderReceipt(reference: string): Promise<void> {
  const [sent] = await sql<{ reference: string }[]>`SELECT reference FROM order_email_receipts WHERE reference = ${reference}`;
  const order = await getOrderByReference(reference);
  if (!order || !["paid", "in_proof", "in_production", "shipped"].includes(order.status)) return;
  const lines = order.items.map((item) => `${item.quantity} × ${item.productName} (${item.colorName})`);
  if (!sent) {
  const providerId = await sendEmail({
    to: order.email,
    subject: `Your Kingdom Custom Print order ${reference}`,
    text: `Hi ${order.name},\n\nThank you for your order. Your payment has been received.\n\nOrder: ${reference}\n${lines.join("\n")}\nTotal: $${order.total.toFixed(2)}\n\nFor questions about your order, please contact us and include your order reference.\n\nKingdom Custom Print`,
    action: { label: "Contact us", url: "https://kingdomcustomprint.com/contact" },
    idempotencyKey: `order-receipt/${reference}`,
  });
  await sql`INSERT INTO order_email_receipts (reference, provider_id) VALUES (${reference}, ${providerId}) ON CONFLICT (reference) DO NOTHING`;
  }
  const destination = process.env.SUPPORT_EMAIL?.trim();
  if (!destination) throw new Error("Business notification email is not configured");
  const [notified] = await sql<{ reference: string }[]>`SELECT reference FROM order_business_notifications WHERE reference = ${reference}`;
  if (!notified) {
    const providerId = await sendEmail({
      to: destination,
      subject: `New paid order ${reference}`,
      text: `A new order has been paid.\n\nOrder: ${reference}\nCustomer: ${order.name}\n${lines.join("\n")}\nTotal: $${order.total.toFixed(2)}\n\nSign in to the admin dashboard to review the order and artwork.`,
      action: { label: "Open admin dashboard", url: "https://kingdomcustomprint.com/admin" },
      idempotencyKey: `order-business/${reference}`,
    });
    await sql`INSERT INTO order_business_notifications (reference, provider_id) VALUES (${reference}, ${providerId}) ON CONFLICT (reference) DO NOTHING`;
  }
}
