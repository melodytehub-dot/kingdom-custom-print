"use client";

import { useState } from "react";

export default function InvoicePayment({ token, stripe, paypal }: { token: string; stripe: boolean; paypal: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function pay(provider: "stripe" | "paypal") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/invoice/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, provider }) });
      const result = await response.json() as { error?: string; url?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Could not start payment. Please try again.");
      const url = new URL(result.url);
      if (url.protocol !== "https:" || !["checkout.stripe.com", "www.paypal.com", "paypal.com"].includes(url.hostname)) throw new Error("Could not start payment. Please try again.");
      window.location.assign(url.href);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not start payment. Please try again."); setBusy(false); }
  }
  return <section className="admin-invoice-customer"><h2>Pay this invoice</h2><div className="admin-quote-actions">{stripe ? <button type="button" className="btn" disabled={busy} onClick={() => void pay("stripe")}>Pay by card</button> : null}{paypal ? <button type="button" className="btn btn-light" disabled={busy} onClick={() => void pay("paypal")}>Pay with PayPal</button> : null}</div>{busy ? <p role="status">Opening secure checkout…</p> : null}{message ? <p role="alert">{message}</p> : null}{!stripe && !paypal ? <p>Online payment is currently unavailable. Please contact us.</p> : null}</section>;
}
