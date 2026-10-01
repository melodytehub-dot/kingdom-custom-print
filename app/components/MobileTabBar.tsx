"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/shop", label: "Shop", icon: "▦" },
  { href: "/collections", label: "Categories", icon: "⋮⋮⋮" },
  { href: "/account", label: "Account", icon: "◔" },
  { href: "/wishlist", label: "Wishlist", icon: "♡" }
];

export default function MobileTabBar() {
  const path = usePathname();
  if (path?.startsWith("/customize")) return null;
  return (
    <nav aria-label="Mobile tabs" style={{ position: "sticky", bottom: 0, zIndex: 40, background: "#fff", borderTop: "1px solid var(--line)", display: "none" }} className="mtabs">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px 0 calc(10px + env(safe-area-inset-bottom))", fontSize: 12, fontWeight: path === t.href ? 800 : 500 }}>
            <span style={{ fontSize: 20 }} aria-hidden>{t.icon}</span>{t.label}
          </Link>
        ))}
      </div>
      <style>{`@media(max-width:760px){.mtabs{display:block!important}}`}</style>
    </nav>
  );
}
