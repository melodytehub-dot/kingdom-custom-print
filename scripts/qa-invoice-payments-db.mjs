/**
 * Invoice payment attempts: one live attempt per invoice, retries reuse it,
 * provider totals are verified, and a closed checkout can be replaced.
 */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

// Use environment credentials (the vault is disabled) so the PayPal client can
// talk to a stubbed fetch instead of the real API.
delete process.env.PAYMENT_CREDENTIALS_KEY;
process.env.PAYPAL_CLIENT_ID = "qa-client";
process.env.PAYPAL_CLIENT_SECRET = "qa-secret";

const harness = await createHarness({ name: "invoice-payments" });
const { db, load } = harness;

let paypalOrder = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.includes("/v1/oauth2/token")) {
    return new Response(JSON.stringify({ access_token: "qa-token" }), { status: 200 });
  }
  if (target.includes("/capture")) {
    const unit = paypalOrder.purchase_units[0];
    paypalOrder = {
      ...paypalOrder,
      status: "COMPLETED",
      purchase_units: [
        {
          ...unit,
          payments: {
            captures: [
              { id: "CAPTURE123", status: "COMPLETED", amount: { currency_code: "USD", value: unit.amount.value } },
            ],
          },
        },
      ],
    };
    return new Response(JSON.stringify(paypalOrder), { status: 200 });
  }
  return new Response(JSON.stringify(paypalOrder), { status: 200 });
};

const invoicePayments = await load("/lib/invoice-payments.ts");

const lines = JSON.stringify([{ quantity: 2, unitCents: 500 }]);
const insertQuote = (id, status = "invoice") =>
  db
    .prepare("INSERT INTO admin_quotes (id, customer_name, customer_email, notes, lines, shipping_cents, status) VALUES (?, ?, ?, '', ?, 200, ?)")
    .run(id, "Quote test", "buyer@example.test", lines, status);
const insertToken = (hash, quoteId, hours = 1) =>
  db
    .prepare("INSERT INTO invoice_share_tokens (token_hash, quote_id, expires_at) VALUES (?, ?, ?)")
    .run(hash, quoteId, new Date(Date.now() + hours * 3600 * 1000).toISOString());

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  insertQuote(1);
  insertToken("hash", 1);

  const results = await Promise.allSettled([
    invoicePayments.reserveInvoicePayment("hash", "stripe"),
    invoicePayments.reserveInvoicePayment("hash", "paypal"),
  ]);
  check("only one payment method can start", results.filter((result) => result.status === "fulfilled").length === 1);
  check("the competing method is refused", results.filter((result) => result.status === "rejected").length === 1);
  const winner = results.find((result) => result.status === "fulfilled").value.attempt;
  check("the invoice total includes shipping", Number(winner.amount_cents) === 1200);
  const replay = await invoicePayments.reserveInvoicePayment("hash", winner.provider);
  check("a retry reuses the same attempt", replay.attempt.id === winner.id);
  check("one attempt is stored", db.prepare("SELECT count(*) AS n FROM invoice_payment_attempts").get().n === 1);

  insertQuote(2);
  insertToken("hash2", 2);
  const stripe = (await invoicePayments.reserveInvoicePayment("hash2", "stripe")).attempt;
  await invoicePayments.attachInvoiceCheckout(stripe.id, "cs_fixture", "https://checkout.stripe.com/fixture");
  const session = {
    id: "cs_fixture",
    metadata: { invoiceAttemptId: stripe.id },
    payment_status: "paid",
    currency: "usd",
    amount_total: 1200,
    payment_intent: "pi_fixture",
  };
  let wrongAmount = false;
  try {
    await invoicePayments.recordStripeInvoicePayment({ ...session, amount_total: 1 });
  } catch {
    wrongAmount = true;
  }
  check("a mismatched Stripe total is refused", wrongAmount);
  check("a Stripe invoice payment is recorded", (await invoicePayments.recordStripeInvoicePayment(session)) === true);
  check("a replayed Stripe payment is accepted", (await invoicePayments.recordStripeInvoicePayment(session)) === true);
  let paidAgain = false;
  try {
    await invoicePayments.reserveInvoicePayment("hash2", "stripe");
  } catch {
    paidAgain = true;
  }
  check("a paid invoice cannot start another payment", paidAgain);

  insertQuote(3);
  insertToken("hash3", 3);
  const paypal = (await invoicePayments.reserveInvoicePayment("hash3", "paypal")).attempt;
  await invoicePayments.attachInvoiceCheckout(paypal.id, "PAYPAL123", "https://www.paypal.com/fixture");
  paypalOrder = {
    id: "PAYPAL123",
    status: "APPROVED",
    purchase_units: [{ custom_id: `invoice-${paypal.id}`, amount: { currency_code: "USD", value: "0.01" } }],
  };
  let paypalMismatch = false;
  try {
    await invoicePayments.capturePayPalInvoice("PAYPAL123");
  } catch {
    paypalMismatch = true;
  }
  check("a mismatched PayPal total is refused", paypalMismatch);
  paypalOrder.purchase_units[0].amount.value = "12.00";
  check("a PayPal invoice payment is captured", (await invoicePayments.capturePayPalInvoice("PAYPAL123")) === true);
  check("a replayed PayPal capture is accepted", (await invoicePayments.capturePayPalInvoice("PAYPAL123")) === true);
  let paypalPaidAgain = false;
  try {
    await invoicePayments.reserveInvoicePayment("hash3", "paypal");
  } catch {
    paypalPaidAgain = true;
  }
  check("a PayPal-paid invoice cannot start another payment", paypalPaidAgain);

  insertQuote(4);
  insertToken("hash4", 4);
  const expired = (await invoicePayments.reserveInvoicePayment("hash4", "stripe")).attempt;
  await invoicePayments.attachInvoiceCheckout(expired.id, "cs_expired", "https://checkout.stripe.com/expired");
  await invoicePayments.closeStripeInvoiceSession({ id: "cs_expired", metadata: { invoiceAttemptId: expired.id } });
  const replacement = (await invoicePayments.reserveInvoicePayment("hash4", "paypal")).attempt;
  check("a closed checkout can be replaced with another method", replacement.id !== expired.id);
  let latePaid = false;
  try {
    await invoicePayments.recordStripeInvoicePayment({
      ...session,
      id: "cs_expired",
      metadata: { invoiceAttemptId: expired.id },
    });
  } catch {
    latePaid = true;
  }
  check("a late Stripe event for the closed checkout is refused", latePaid);

  insertQuote(5, "quote");
  insertToken("hash5", 5);
  let notInvoiced = false;
  try {
    await invoicePayments.reserveInvoicePayment("hash5", "stripe");
  } catch {
    notInvoiced = true;
  }
  check("a quote that is not an invoice cannot be paid", notInvoiced);

  insertQuote(6);
  db.prepare("UPDATE invoice_share_tokens SET expires_at = ? WHERE token_hash = ?").run(
    new Date(Date.now() - 1000).toISOString(),
    "hash"
  );
  let expiredLink = false;
  try {
    await invoicePayments.reserveInvoicePayment("hash", "stripe");
  } catch {
    expiredLink = true;
  }
  check("an expired invoice link cannot be paid", expiredLink);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  globalThis.fetch = realFetch;
  await harness.close();
}

console.log(failures ? `\n${failures} invoice payment check(s) failed` : "\nall invoice payment checks passed");
process.exit(failures ? 1 : 0);
