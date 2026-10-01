"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
function Inner() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "confirmed";
  return (
    <div className="wrap" style={{ paddingTop: 50, paddingBottom: 50, textAlign: "center" }}>
      <p className="eyebrow">Order confirmed</p>
      <h1>Thanks — we got it.</h1>
      <p className="muted">Order <strong>{id}</strong> is in the print queue. A receipt and artwork proof were sent to your email.</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
        <Link href="/shop" className="btn ghost">Keep shopping</Link>
        <Link href="/account" className="btn">View orders</Link>
      </div>
    </div>
  );
}
export default function Success() { return <Suspense><Inner /></Suspense>; }
