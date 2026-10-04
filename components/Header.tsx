import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/types";
import { getSettings } from "@/lib/catalog";
import CartButton from "./CartButton";
import MobileNav from "./MobileNav";
import WishlistIconBtn from "./WishlistIconBtn";
import Search from "./icons/Search";

const MAIN_NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/shop", label: "SHOP ALL" },
  { href: "/shop?kind=tee", label: "T-SHIRTS" },
  { href: "/shop?kind=hoodie", label: "HOODIES" },
  { href: "/customize", label: "DESIGN STUDIO", highlight: true },
  { href: "/about", label: "HOW IT WORKS" },
  { href: "/track", label: "TRACK ORDER" },
  { href: "/contact", label: "CONTACT" },
];

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default async function Header({
  categories = [],
}: {
  categories?: Category[];
}) {
  const settings = await getSettings().catch(() => ({}));

  return (
    <header className="mm-header-wrapper">
      {/* 1. TOP ANNOUNCEMENT BAR */}
      <div className="mm-topbar">
        <div className="minimog-container mm-topbar-inner">
          <div className="mm-topbar-left">
            <Link href="/faq">Help Center</Link>
            <span>•</span>
            <Link href="/track">Find A Store</Link>
          </div>
          <div className="mm-topbar-center">
            <span>✌🏼 Free Express Shipping on orders over $100!</span>
          </div>
          <div className="mm-topbar-right">
            <span>
              <span className="mm-flag-icon" role="img" aria-label="USA flag">🇺🇸</span>
              English ▾
            </span>
            <span>USD ▾</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER */}
      <div className="mm-header">
        <div className="minimog-container mm-header-main">
          {/* Mobile hamburger */}
          <MobileNav categories={categories} />

          {/* Real Brand Logo */}
          <Link href="/" className="mm-logo" aria-label="Kingdom Custom Print — Home">
            <Image
              src="/brand/kingdom-logo.png"
              alt="Kingdom Custom Print"
              width={180}
              height={55}
              priority
              style={{ height: "46px", width: "auto", objectFit: "contain" }}
            />
          </Link>

          {/* Search form */}
          <div className="mm-search-wrap">
            <form action="/shop" method="GET" className="mm-search-form" role="search">
              <select name="category" className="mm-search-category" aria-label="Select product category">
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                name="q"
                placeholder="Search products, designs, blanks..."
                className="mm-search-input"
                aria-label="Search products"
              />
              <button type="submit" className="mm-search-btn" aria-label="Submit search">
                <Search size={18} />
              </button>
            </form>
          </div>

          {/* Right Header Actions */}
          <div className="mm-header-actions">
            <Link href="/admin" className="mm-action-btn hide-sm" aria-label="My Account / Admin">
              <UserIcon />
            </Link>

            <div className="hide-sm">
              <WishlistIconBtn />
            </div>

            <CartButton />

            <Link href="/customize" className="mm-btn mm-btn-black hide-sm" style={{ height: "42px", padding: "0 22px" }}>
              Start Designing
            </Link>
          </div>
        </div>
      </div>

      {/* 3. LOWER CATEGORY NAVIGATION BAR */}
      <nav className="mm-nav-bar" aria-label="Category Navigation">
        <div className="minimog-container mm-nav-inner">
          <ul className="mm-nav-links">
            {MAIN_NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`mm-nav-link ${link.highlight ? "highlight" : ""}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
