import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { sql } from "./db";
import { paypalRequest } from "./paypal";

export type InvoiceAttempt = {
  id: string;
  quote_id: number;
  provider: "stripe" | "paypal";
  amount_cents: number;
  state: "creating" | "open" | "paid" | "closed" | "refunded";
  provider_id: string | null;
  payment_id: string | null;
  checkout_url: string | null;
  created_at: string;
};

type InvoiceRow = {
  id: number;
  customer_email: string;
  lines: unknown;
  shipping_cents: number;
};

export class InvoicePaymentError extends Error {}

const attemptColumns = sql`
  id, quote_id, provider, amount_cents, state, provider_id, payment_id, checkout_url, created_at`;

async function liveAttempt(quoteId: number): Promise<InvoiceAttempt | null> {
  const [row] = await sql<InvoiceAttempt[]>`
    SELECT ${attemptColumns} FROM invoice_payment_attempts
    WHERE quote_id = ${quoteId} AND state IN ('creating', 'open', 'paid', 'refunded')
    LIMIT 1`;
  return row ?? null;
}

function parseLines(value: unknown): { quantity: number; unitCents: number }[] {
  if (Array.isArray(value)) return value as { quantity: number; unitCents: number }[];
  if (typeof value !== "string") return [];
  try {
    return JSON.parse(value) as { quantity: number; unitCents: number }[];
  } catch {
    return [];
  }
}

/** Reuses an in-flight attempt when it is the same provider and amount. */
function assertReusable(existing: InvoiceAttempt, provider: "stripe" | "paypal", amount: number): void {
  if (existing.state === "paid" || existing.state === "refunded") {
    throw new InvoicePaymentError("This invoice has already been paid. Please contact us if you have questions.");
  }
  if (existing.provider !== provider) {
    throw new InvoicePaymentError("A payment is already in progress with another method. Please return to that checkout or contact us.");
  }
  if (Number(existing.amount_cents) !== amount) {
    throw new InvoicePaymentError("This invoice has changed. Please contact us.");
  }
  if (existing.state === "creating" && Date.now() - new Date(existing.created_at).getTime() > 5 * 60 * 60 * 1000) {
    throw new InvoicePaymentError("We could not confirm an earlier payment attempt. Please contact us before trying again.");
  }
}

/**
 * Reserves the one live payment attempt for an invoice. The partial unique index
 * `invoice_payment_one_live` serialises concurrent attempts, so a lost race falls
 * back to reading the attempt that won.
 */
export async function reserveInvoicePayment(tokenHash: string, provider: "stripe" | "paypal") {
  const [invoice] = await sql<InvoiceRow[]>`
    SELECT q.id, q.customer_email, q.lines, q.shipping_cents
    FROM invoice_share_tokens t
    JOIN admin_quotes q ON q.id = t.quote_id
    WHERE t.token_hash = ${tokenHash}
      AND t.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
      AND q.status = 'invoice'
    LIMIT 1`;
  if (!invoice) throw new InvoicePaymentError("This invoice link is unavailable. Please contact us.");

  const amount = parseLines(invoice.lines).reduce(
    (sum, line) => sum + line.quantity * line.unitCents,
    invoice.shipping_cents
  );
  if (!Number.isSafeInteger(amount) || amount < 50 || amount > 99999999) {
    throw new InvoicePaymentError("Please contact us to arrange payment for this invoice.");
  }

  const existing = await liveAttempt(invoice.id);
  if (existing) {
    assertReusable(existing, provider, amount);
    return { invoice, attempt: existing };
  }

  const id = randomUUID();
  const inserted = await sql<InvoiceAttempt[]>`
    INSERT INTO invoice_payment_attempts (id, quote_id, provider, amount_cents)
    VALUES (${id}, ${invoice.id}, ${provider}, ${amount})
    ON CONFLICT (quote_id) WHERE state IN ('creating', 'open', 'paid', 'refunded') DO NOTHING
    RETURNING ${attemptColumns}`;
  if (inserted.length) return { invoice, attempt: inserted[0] };

  const raced = await liveAttempt(invoice.id);
  if (!raced) throw new InvoicePaymentError("This invoice is being paid right now. Please try again in a moment.");
  assertReusable(raced, provider, amount);
  return { invoice, attempt: raced };
}

/** Persist the provider's id without reviving an already paid or closed attempt. */
export async function attachInvoiceCheckout(attemptId: string, providerId: string, url: string) {
  const [row] = await sql<InvoiceAttempt[]>`
    UPDATE invoice_payment_attempts
    SET provider_id = ${providerId}, checkout_url = ${url},
        state = CASE WHEN state = 'creating' THEN 'open' ELSE state END
    WHERE id = ${attemptId} AND (provider_id IS NULL OR provider_id = ${providerId})
    RETURNING ${attemptColumns}`;
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
  const rows = await sql`
    UPDATE invoice_payment_attempts
    SET provider_id = ${session.id}, payment_id = ${paymentId}, state = 'paid',
        paid_at = COALESCE(paid_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    WHERE id = ${id} AND provider = 'stripe' AND amount_cents = ${session.amount_total}
      AND state IN ('creating', 'open', 'paid')
      AND (provider_id IS NULL OR provider_id = ${session.id})
    RETURNING id`;
  if (!rows.length) {
    const [refunded] = await sql`
      SELECT id FROM invoice_payment_attempts
      WHERE id = ${id} AND provider = 'stripe' AND provider_id = ${session.id}
        AND payment_id = ${paymentId} AND amount_cents = ${session.amount_total}
        AND state = 'refunded'`;
    if (!refunded) throw new Error("Invoice payment mismatch");
  }
  return true;
}

export async function closeStripeInvoiceSession(session: Stripe.Checkout.Session) {
  const id = session.metadata?.invoiceAttemptId;
  if (!id) return false;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid invoice attempt");
  const rows = await sql`
    UPDATE invoice_payment_attempts
    SET provider_id = ${session.id}, state = 'closed'
    WHERE id = ${id} AND provider = 'stripe' AND state IN ('creating', 'open', 'closed')
      AND (provider_id IS NULL OR provider_id = ${session.id})
    RETURNING id`;
  if (!rows.length) {
    const [paid] = await sql`
      SELECT id FROM invoice_payment_attempts
      WHERE id = ${id} AND provider = 'stripe' AND provider_id = ${session.id}
        AND state IN ('paid', 'refunded')`;
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
  const [attempt] = await sql<InvoiceAttempt[]>`
    SELECT ${attemptColumns} FROM invoice_payment_attempts
    WHERE id = ${id} AND provider = 'paypal'`;
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
  const rows = await sql`
    UPDATE invoice_payment_attempts
    SET provider_id = ${providerId}, payment_id = ${capture.id}, state = ${state},
        paid_at = COALESCE(paid_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    WHERE id = ${id} AND provider = 'paypal' AND state IN ('creating', 'open', 'paid')
      AND (provider_id IS NULL OR provider_id = ${providerId})
      AND (payment_id IS NULL OR payment_id = ${capture.id})
    RETURNING id`;
  if (!rows.length) throw new Error("PayPal invoice payment mismatch");
  return true;
}
