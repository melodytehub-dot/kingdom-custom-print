import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { sql } from "./db";
import { paypalRequest } from "./paypal";

export type InvoiceAttempt = { id: string; quote_id: string; provider: "stripe" | "paypal"; amount_cents: string; state: "creating" | "open" | "paid" | "closed" | "refunded"; provider_id: string | null; payment_id: string | null; checkout_url: string | null; created_at: Date };

export class InvoicePaymentError extends Error {}

/** Lock the invoice before choosing a provider. Never release an uncertain attempt. */
export async function reserveInvoicePayment(tokenHash: string, provider: "stripe" | "paypal") {
  return sql.begin(async (tx) => {
    const [invoice] = await tx<{ id: string; customer_email: string; lines: { quantity: number; unitCents: number }[]; shipping_cents: number }[]>`
      SELECT q.id::text, q.customer_email, q.lines, q.shipping_cents FROM invoice_share_tokens t
      JOIN admin_quotes q ON q.id = t.quote_id WHERE t.token_hash = ${tokenHash} AND t.expires_at > now() AND q.status = 'invoice' FOR UPDATE OF q`;
    if (!invoice) throw new InvoicePaymentError("This invoice link is unavailable. Please contact us.");
    const amount = invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitCents, invoice.shipping_cents);
    if (!Number.isSafeInteger(amount) || amount < 50 || amount > 99999999) throw new InvoicePaymentError("Please contact us to arrange payment for this invoice.");
    const [existing] = await tx<InvoiceAttempt[]>`SELECT id::text, quote_id::text, provider, amount_cents::text, state, provider_id, payment_id, checkout_url, created_at FROM invoice_payment_attempts WHERE quote_id = ${invoice.id}::bigint AND state IN ('creating', 'open', 'paid', 'refunded') LIMIT 1`;
    if (existing) {
      if (existing.state === "paid" || existing.state === "refunded") throw new InvoicePaymentError("This invoice has already been paid. Please contact us if you have questions.");
      if (existing.provider !== provider) throw new InvoicePaymentError("A payment is already in progress with another method. Please return to that checkout or contact us.");
      if (Number(existing.amount_cents) !== amount) throw new InvoicePaymentError("This invoice has changed. Please contact us.");
      if (existing.state === "creating" && Date.now() - new Date(existing.created_at).getTime() > 5 * 60 * 60 * 1000) throw new InvoicePaymentError("We could not confirm an earlier payment attempt. Please contact us before trying again.");
      return { invoice, attempt: existing };
    }
    const id = randomUUID();
    const [attempt] = await tx<InvoiceAttempt[]>`INSERT INTO invoice_payment_attempts (id, quote_id, provider, amount_cents) VALUES (${id}::uuid, ${invoice.id}::bigint, ${provider}, ${amount}) RETURNING id::text, quote_id::text, provider, amount_cents::text, state, provider_id, payment_id, checkout_url, created_at`;
    return { invoice, attempt };
  });
}

/** Persist the provider's id without reviving an already paid or closed attempt. */
export async function attachInvoiceCheckout(attemptId: string, providerId: string, url: string) {
  const [row] = await sql<InvoiceAttempt[]>`UPDATE invoice_payment_attempts SET provider_id = ${providerId}, checkout_url = ${url}, state = CASE WHEN state = 'creating' THEN 'open' ELSE state END WHERE id = ${attemptId}::uuid AND (provider_id IS NULL OR provider_id = ${providerId}) RETURNING id::text, quote_id::text, provider, amount_cents::text, state, provider_id, payment_id, checkout_url, created_at`;
  if (!row) throw new Error("Invoice checkout mismatch");
  return row;
}

export async function recordStripeInvoicePayment(session: Stripe.Checkout.Session) {
  const id = session.metadata?.invoiceAttemptId;
  if (!id) return false;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid invoice attempt");
  if (session.payment_status !== "paid" || session.currency !== "usd" || !Number.isSafeInteger(session.amount_total)) throw new Error("Invoice payment is not confirmed");
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentId) throw new Error("Invoice payment has no payment intent");
  const rows = await sql`UPDATE invoice_payment_attempts SET provider_id = ${session.id}, payment_id = ${paymentId}, state = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = ${id}::uuid AND provider = 'stripe' AND amount_cents = ${session.amount_total} AND state IN ('creating', 'open', 'paid') AND (provider_id IS NULL OR provider_id = ${session.id}) RETURNING id`;
  if (!rows.length) {
    const [refunded] = await sql`SELECT id FROM invoice_payment_attempts WHERE id = ${id}::uuid AND provider = 'stripe' AND provider_id = ${session.id} AND payment_id = ${paymentId} AND amount_cents = ${session.amount_total} AND state = 'refunded'`;
    if (!refunded) throw new Error("Invoice payment mismatch");
  }
  return true;
}

export async function closeStripeInvoiceSession(session: Stripe.Checkout.Session) {
  const id = session.metadata?.invoiceAttemptId;
  if (!id) return false;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid invoice attempt");
  const rows = await sql`UPDATE invoice_payment_attempts SET provider_id = ${session.id}, state = 'closed' WHERE id = ${id}::uuid AND provider = 'stripe' AND state IN ('creating', 'open', 'closed') AND (provider_id IS NULL OR provider_id = ${session.id}) RETURNING id`;
  if (!rows.length) {
    const [paid] = await sql`SELECT id FROM invoice_payment_attempts WHERE id = ${id}::uuid AND provider = 'stripe' AND provider_id = ${session.id} AND state IN ('paid', 'refunded')`;
    if (!paid) throw new Error("Invoice checkout mismatch");
  }
  return true;
}

type PayPalInvoiceOrder = { id?: string; status?: string; purchase_units?: { custom_id?: string; amount?: { value?: string; currency_code?: string }; payments?: { captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] };

/** Retrieve the provider order before capturing, then verify the final capture. */
export async function capturePayPalInvoice(providerId: string): Promise<boolean> {
  if (!/^[A-Z0-9]{1,20}$/.test(providerId)) return false;
  let order = await paypalRequest<PayPalInvoiceOrder>(`/v2/checkout/orders/${providerId}`);
  const unit = order.purchase_units?.[0];
  const match = /^invoice-([0-9a-f-]{36})$/i.exec(unit?.custom_id ?? "");
  if (!match) return false;
  const id = match[1];
  const [attempt] = await sql<InvoiceAttempt[]>`SELECT id::text, quote_id::text, provider, amount_cents::text, state, provider_id, payment_id, checkout_url, created_at FROM invoice_payment_attempts WHERE id = ${id}::uuid AND provider = 'paypal'`;
  if (!attempt || (attempt.provider_id && attempt.provider_id !== providerId) || unit?.amount?.currency_code !== "USD" || unit.amount.value !== (Number(attempt.amount_cents) / 100).toFixed(2)) throw new Error("PayPal invoice mismatch");
  if (attempt.state === "refunded") return true;
  if (attempt.state === "closed") throw new Error("PayPal invoice is closed");
  if (order.status === "APPROVED") {
    try { order = await paypalRequest<PayPalInvoiceOrder>(`/v2/checkout/orders/${providerId}/capture`, { method: "POST", body: "{}", requestId: `capture-${providerId}` }); }
    catch { order = await paypalRequest<PayPalInvoiceOrder>(`/v2/checkout/orders/${providerId}`); }
  }
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status !== "COMPLETED" || !["COMPLETED", "REFUNDED"].includes(capture?.status ?? "") || !capture?.id || !/^[A-Z0-9]{1,20}$/.test(capture.id) || capture.amount?.currency_code !== "USD" || capture.amount.value !== (Number(attempt.amount_cents) / 100).toFixed(2)) throw new Error("PayPal invoice payment is not confirmed");
  const state = capture.status === "REFUNDED" ? "refunded" : "paid";
  const rows = await sql`UPDATE invoice_payment_attempts SET provider_id = ${providerId}, payment_id = ${capture.id}, state = ${state}, paid_at = COALESCE(paid_at, now()) WHERE id = ${id}::uuid AND provider = 'paypal' AND state IN ('creating', 'open', 'paid') AND (provider_id IS NULL OR provider_id = ${providerId}) AND (payment_id IS NULL OR payment_id = ${capture.id}) RETURNING id`;
  if (!rows.length) throw new Error("PayPal invoice payment mismatch");
  return true;
}
