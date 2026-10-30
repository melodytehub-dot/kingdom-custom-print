import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch about your order or custom printing needs.",
};

export default async function TrackPage() {
  // Shipping is handled manually - redirect to contact page
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Order information</p>
        <h1 className="display">Need help with your order?</h1>
        <p className="lede">
          Shipping and order updates are handled directly by our team. Contact us for the latest information about your order.
        </p>
      </div>

      <div className="wrap section-tight">
        <div className="panel panel-pad" style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 className="h3">Get order updates</h2>
          <p style={{ marginBottom: "24px" }}>
            Our team provides personalized shipping updates and order status. Reach out with your order reference and we'll get you the latest information.
          </p>

          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
            <h3 className="h3" style={{ fontSize: "16px", marginBottom: "12px" }}>Contact our team</h3>
            <p className="small muted" style={{ marginBottom: "16px" }}>
              Questions about production timeline, shipping, or your custom design? We're here to help.
            </p>
            <Link href="/contact" className="btn btn-lg">Contact us</Link>
          </div>
        </div>

        <div style={{ marginTop: "48px", textAlign: "center" }}>
          <p className="small muted" style={{ marginBottom: "12px" }}>Your order reference was included in your checkout confirmation email.</p>
          <Link href="/account" className="link">View your orders in your account</Link>
        </div>
      </div>
    </>
  );
}
