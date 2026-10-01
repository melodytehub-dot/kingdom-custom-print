"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "../lib/store";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/collections", label: "Collections" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

export default function Navbar() {
  const { cartCount } = useStore();
  const [q, setQ] = useState("");
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid var(--line)", boxShadow: stuck ? "0 6px 20px rgba(0,0,0,.06)" : "none" }}>
      <div style={{ background: "#141414", color: "#fff", fontSize: 12 }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 8, paddingBottom: 8 }}>
          <span>Free US shipping on orders over $75</span>
          <span style={{ display: "flex", gap: 16 }}><Link href="/about">Help</Link><Link href="/contact">Contact</Link></span>
        </div>
      </div>
      <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 18, height: 66 }}>
        <button aria-label="Open menu" onClick={() => setOpen(!open)} style={{ display: "none", background: "none", border: 0, fontSize: 22 }} className="menuBtn">☰</button>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }} aria-label="Kingdom Custom Print home">
          <img src="/kingdom-logo.svg" alt="Kingdom Custom Print" width={150} height={40} style={{ display: "block", height: 40, width: "auto" }} />
        </Link>
        <nav aria-label="Primary" style={{ display: "flex", gap: 20, marginLeft: 12 }} className="deskNav">
          {NAV.map((n) => <Link key={n.href} href={n.href} style={{ fontSize: 14, fontWeight: 600 }}>{n.label}</Link>)}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <form role="search" action="/shop" style={{ display: "flex" }} className="deskSearch">
            <input className="input" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" style={{ width: 170, padding: "8px 10px" }} />
          </form>
          <Link href="/account" aria-label="Account" style={{ fontSize: 19 }}>◔</Link>
          <Link href="/wishlist" aria-label="Wishlist" style={{ fontSize: 19 }}>♡</Link>
          <Link href="/cart" aria-label={`Cart, ${cartCount} items`} style={{ fontSize: 19, position: "relative" }}>🛒{cartCount > 0 && <span style={{ position: "absolute", top: -8, right: -10, background: "var(--red)", color: "#fff", fontSize: 11, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{cartCount}</span>}</Link>
          <Link href="/customize" className="btn" style={{ background: "var(--orange)", borderColor: "var(--orange)", padding: "10px 16px" }}>Design yours</Link>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="wrap" style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 12 }}>
          {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} style={{ padding: "10px 0", borderTop: "1px solid var(--line)", fontWeight: 600 }}>{n.label}</Link>)}
          <Link href="/customize" onClick={() => setOpen(false)} className="btn" style={{ marginTop: 8 }}>Design yours</Link>
        </nav>
      )}
      <style>{`@media(max-width:900px){.deskNav,.deskSearch{display:none!important}.menuBtn{display:block!important}}`}</style>
    </header>
  );
}
