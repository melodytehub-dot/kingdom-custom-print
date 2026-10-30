"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { url?: string; paymentStatus?: string; refundStatus?: string | null; error?: string };

export default function StripeTestPage() {
  const router = useRouter();
  const [session, setSession] = useState("");
  const [result, setResult] = useState<Result>({});
  const [busy, setBusy] = useState(false);
  
  useEffect(() => {
    // Hide in production
    if (process.env.NODE_ENV === "production" && !window.location.hostname.includes("localhost")) {
      router.push("/admin");
      return;
    }
    setSession(new URLSearchParams(window.location.search).get("session_id") ?? "");
  }, [router]);

  async function action(name: "start" | "status" | "refund") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/stripe-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, session }) });
      const data = await response.json() as Result;
      if (response.status === 401) { setResult({ error: "Sign in to the admin dashboard in this browser, then return to this page." }); return; }
      if (!response.ok) { setResult({ error: data.error ?? "The request failed." }); return; }
      if (data.url) { window.location.assign(data.url); return; }
      setResult(data);
    } catch { setResult({ error: "Connection failed. Check the Stripe dashboard before retrying." }); }
    finally { setBusy(false); }
  }

  return <main className="wrap" style={{ maxWidth: 680, paddingTop: 40, paddingBottom: 60 }}>
    <h1>Stripe $1 live payment test</h1>
    <p>This is a real $1 USD card charge. No product will be shipped. You can request a refund after Stripe confirms payment.</p>
    <p>A refund can remain pending if the Stripe balance cannot cover it. Stripe may retain processing fees.</p>
    <p>This is an isolated provider test. It does not verify the store’s normal checkout, webhook delivery, or admin order refund flow.</p>
    {!session ? <button className="btn" disabled={busy} onClick={() => action("start")}>{busy ? "Opening Stripe…" : "Continue to Stripe — $1"}</button> : <>
      <p>After paying on Stripe, check the payment status below.</p>
      <button className="btn" disabled={busy} onClick={() => action("status")}>{busy ? "Checking…" : "Check payment status"}</button>
      {result.paymentStatus === "paid" && !result.refundStatus ? <p><button className="btn" disabled={busy} onClick={() => action("refund")}>Refund this $1 payment</button></p> : null}
    </>}
    {result.paymentStatus ? <p role="status">Stripe payment: {result.paymentStatus}.</p> : null}
    {result.refundStatus ? <p role="status">Stripe refund: {result.refundStatus}. Check Stripe for final confirmation.</p> : null}
    {result.error ? <p role="alert">{result.error}</p> : null}
    <p><a href="/admin">Return to admin</a></p>
  </main>;
}
