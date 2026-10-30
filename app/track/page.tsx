import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Track your order",
  description: "View your order status and get help with your custom printed apparel.",
};

export default async function TrackPage() {
  const settings = await getSettings();

  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Order tracking</p>
        <h1 className="display">Track your order</h1>
        <p className="lede">
          Find your order status using the reference number provided after checkout.
        </p>
      </div>

      <div className="wrap section-tight">
        <div className="panel panel-pad" style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 className="h3">View order details</h2>
          <p style={{ marginBottom: "24px" }}>
            Enter your order reference to view the current status, items, artwork, and delivery information.
          </p>

          <form action="/order/" method="GET" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: "1", minWidth: "240px" }}>
              <label htmlFor="ref" className="sr-only">Order reference</label>
              <input
                type="text"
                id="ref"
                name="ref"
                placeholder="KCP-XXXXXX"
                className="input"
                required
                maxLength={32}
                style={{ width: "100%", textTransform: "uppercase" }}
              />
            </div>
            <button type="submit" className="btn">View order</button>
          </form>

          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
            <h3 className="h3" style={{ fontSize: "16px", marginBottom: "12px" }}>Need help?</h3>
            <p className="small muted" style={{ marginBottom: "16px" }}>
              Questions about your order or production timeline? Contact us for assistance.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link href="/contact" className="btn btn-ghost">Contact support</Link>
              {settings.contactEmail && (
                <a href={`mailto:${settings.contactEmail}`} className="btn btn-light">
                  {settings.contactEmail}
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "48px", textAlign: "center" }}>
          <p className="small muted" style={{ marginBottom: "12px" }}>Your order reference was included in your checkout confirmation.</p>
          <Link href="/account" className="link">View order history in your account</Link>
        </div>
      </div>
    </>
  );
}
