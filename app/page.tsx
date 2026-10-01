import Link from "next/link";
import ProductCard from "./components/ProductCard";
import GarmentSVG from "./components/GarmentSVG";
import { PRODUCTS } from "./lib/products";

const CATS = [
  { label: "T-Shirts", kind: "tee", hex: "#171717", href: "/shop?cat=tee" },
  { label: "Hoodies", kind: "hoodie", hex: "#171717", href: "/shop?cat=hoodie" },
  { label: "Caps", kind: "cap", hex: "#171717", href: "/shop?cat=cap" },
  { label: "Merch", kind: "mug", hex: "#f4f2ec", href: "/shop?cat=mug" }
];

export default function Home() {
  const featured = PRODUCTS.slice(0, 4);
  return (
    <div>
      <section className="wrap" style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 28, alignItems: "center", paddingTop: 34, paddingBottom: 10 }}>
        <div>
          <p className="eyebrow">Custom printed apparel · No minimums</p>
          <h1 className="display" style={{ fontSize: "clamp(44px,7vw,84px)", marginTop: 10 }}>Wear your<br /><span className="accent">identity.</span></h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 460, marginTop: 14 }}>Heavyweight blanks printed to order. Design a one-off tee or outfit the whole team — same studio, same quality.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <Link href="/customize" className="btn">Start designing →</Link>
            <Link href="/shop" className="btn ghost">Shop blanks</Link>
          </div>
          <dl style={{ display: "flex", gap: 22, marginTop: 22, fontSize: 13 }} className="muted">
            <div><dt style={{ fontWeight: 800, color: "var(--ink)" }}>220 GSM</dt><dd style={{ margin: 0 }}>Heavyweight cotton</dd></div>
            <div><dt style={{ fontWeight: 800, color: "var(--ink)" }}>Ships in 3–5 days</dt><dd style={{ margin: 0 }}>Rush available</dd></div>
            <div><dt style={{ fontWeight: 800, color: "var(--ink)" }}>Bulk savings</dt><dd style={{ margin: 0 }}>From 6+ units</dd></div>
          </dl>
        </div>
        <div className="card" style={{ background: "var(--paper)", padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 13, letterSpacing: ".1em" }}>LEGACY BACK PRINT</strong>
            <Link href="/customize?product=legacy-graphic-tee" className="small" style={{ textDecoration: "underline" }}>Recreate it →</Link>
          </div>
          <GarmentSVG kind="tee" hex="#171717" id="hero" />
          <p className="small muted" style={{ margin: 0 }}>Shown: Legacy Graphic Tee in Black, size L. Design area 12″ × 14″.</p>
        </div>
      </section>

      <section className="wrap" aria-label="Categories" style={{ marginTop: 26 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }} className="catgrid">
          {CATS.map((c) => (
            <Link key={c.label} href={c.href} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 58 }}><GarmentSVG kind={c.kind} hex={c.hex} id={c.label} /></span>
              <span><strong style={{ display: "block", fontSize: 13, letterSpacing: ".08em" }}>{c.label.toUpperCase()}</strong><span className="small muted">Shop now →</span></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 34 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: "var(--font-d)", textTransform: "uppercase", margin: 0 }}>Featured products</h2>
          <Link href="/shop" style={{ textDecoration: "underline", fontSize: 14 }}>View all</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 14 }} className="prodgrid">
          {featured.map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 34 }}>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
          <div style={{ padding: 28 }}>
            <p className="eyebrow">How it works</p>
            <h2 style={{ margin: "8px 0" }}>Design → Quantity → Review</h2>
            <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: 15 }}>
              <li><strong>Design</strong> front and back with text, uploads, and ready artwork.</li>
              <li><strong>Quantity</strong> by size. Price updates live with bulk savings.</li>
              <li><strong>Review</strong> previews, check out securely, we print and ship.</li>
            </ol>
            <Link href="/customize" className="btn" style={{ marginTop: 16 }}>Open the studio</Link>
          </div>
          <div style={{ background: "#141414", color: "#fff", padding: 28 }}>
            <p className="eyebrow" style={{ color: "#bbb" }}>Bulk & team orders</p>
            <h3 style={{ margin: "8px 0" }}>Outfit the whole roster.</h3>
            <p className="small" style={{ color: "#ccc" }}>Quantities of 6+ unlock savings automatically. Need 50+ or a quote first? Send the artwork and sizes.</p>
            <Link href="/contact" className="btn" style={{ background: "#fff", color: "#141414", borderColor: "#fff", marginTop: 12 }}>Request a quote</Link>
          </div>
        </div>
      </section>
      <style>{`@media(max-width:900px){section.wrap[style*="1.05fr"]{grid-template-columns:1fr!important}.prodgrid{grid-template-columns:repeat(2,1fr)!important}.catgrid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
    </div>
  );
}
