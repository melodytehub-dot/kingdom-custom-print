import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", marginTop: 56, background: "#fff" }}>
      <div className="wrap" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 24, paddingTop: 36, paddingBottom: 28 }}>
        <div>
          <img src="/kingdom-logo.svg" alt="Kingdom Custom Print" width={170} height={46} />
          <p className="muted small" style={{ maxWidth: 320, marginTop: 12 }}>Custom printed apparel made to order. Tees, hoodies, headwear and merch — design online and we handle the print.</p>
        </div>
        <nav aria-label="Shop"><strong>Shop</strong><div style={{ display: "grid", gap: 8, marginTop: 10, fontSize: 14 }}><Link href="/shop">All products</Link><Link href="/collections">Collections</Link><Link href="/customize">Design yours</Link><Link href="/wishlist">Wishlist</Link></div></nav>
        <nav aria-label="Support"><strong>Support</strong><div style={{ display: "grid", gap: 8, marginTop: 10, fontSize: 14 }}><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/cart">Cart</Link><Link href="/account">Account</Link></div></nav>
        <div><strong>Contact</strong><p className="small muted" style={{ marginTop: 10 }}>Questions about sizing, artwork, or bulk orders? Send a message and we reply within one business day.</p><Link href="/contact" className="btn ghost" style={{ marginTop: 10 }}>Get in touch</Link></div>
      </div>
      <div style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap small muted" style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 14, paddingBottom: 18, flexWrap: "wrap" }}>
          <span>© {new Date().getFullYear()} Kingdom Custom Print. All rights reserved.</span>
          <span>Secure checkout · Free US shipping over $75</span>
        </div>
      </div>
    </footer>
  );
}
