"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { url?: string; orderStatus?: string; captureStatus?: string | null; refundStatus?: string; error?: string };

export default function PayPalTestPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<Result>({});
  const [busy, setBusy] = useState(false);
  
  useEffect(() => {
    // Hide in production
    if (process.env.NODE_ENV === "production" && !window.location.hostname.includes("localhost")) {
      router.push("/admin");
      return;
    }
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, [router]);

  async function action(name: "start" | "capture" | "refund" | "status") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/paypal-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, token }) });
      const data = await response.json() as Result;
      if (response.status === 401) { setResult({ error: "Please sign in to the admin dashboard in this browser, then return to this page." }); return; }
      if (!response.ok) { setResult({ error: data.error ?? "The request failed." }); return; }
      if (data.url) { window.location.assign(data.url); return; }
      setResult(data);
    } catch { setResult({ error: "Connection failed. Check the PayPal dashboard before retrying." }); }
    finally { setBusy(false); }
  }

  return <main className="wrap" style={{ maxWidth: 680, paddingTop: 40, paddingBottom: 60 }}>
    <h1>PayPal $1 live payment test</h1>
    <p>This is a real $1 USD charge to test PayPal. No product will be shipped. You can request a refund after the payment is captured.</p>
    <p>PayPal may offer a debit or credit card option without an account; availability depends on PayPal and the payer.</p>
    <p>This is an isolated provider test. It does not verify the store’s normal checkout, webhook delivery, or admin order refund flow.</p>
    {!token ? <button className="btn" disabled={busy} onClick={() => action("start")}>{busy ? "Opening PayPal…" : "Continue to PayPal — $1"}</button> : <>
      <p>PayPal returned you to the store. Click below to complete the payment after approving it on PayPal.</p>
      <button className="btn" disabled={busy || result.captureStatus === "COMPLETED"} onClick={() => action("capture")}>{busy ? "Checking…" : "Complete $1 payment"}</button>{" "}
      <button className="btn" disabled={busy} onClick={() => action("status")}>Check payment status</button>
      {result.captureStatus === "COMPLETED" && !result.refundStatus ? <p><button className="btn" disabled={busy} onClick={() => action("refund")}>Refund this $1 payment</button></p> : null}
    </>}
    {result.orderStatus ? <p role="status">PayPal order: {result.orderStatus}. Payment: {result.captureStatus ?? "not captured"}.</p> : null}
    {result.refundStatus ? <p role="status">Refund status: {result.refundStatus}. Check PayPal for final confirmation.</p> : null}
    {result.error ? <p role="alert">{result.error}</p> : null}
    <p><a href="/admin">Return to admin</a></p>
  </main>;
}
