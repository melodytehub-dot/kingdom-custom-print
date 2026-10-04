"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CartIcon from "./icons/CartIcon";
import Store from "./icons/Store";
import Palette from "./icons/Palette";
import { useWishlist } from "@/lib/wishlist-context";
import { useCart } from "@/lib/cart-context";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function StarTabIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function MobileTabBar() {
  const pathname = usePathname();
  const { slugs } = useWishlist();
  const { count, hydrated } = useCart();
  const showCount = hydrated && count > 0;
  if (pathname.startsWith("/customize/") || pathname.startsWith("/admin")) return null;

  return (
    <nav className="mm-mobile-tabs" aria-label="Mobile Bottom Navigation">
      <Link
        href="/"
        className={`mm-mobile-tab-link ${pathname === "/" ? "active" : ""}`}
        aria-label="Home"
      >
        <HomeIcon />
        <span>Home</span>
      </Link>

      <Link
        href="/shop"
        className={`mm-mobile-tab-link ${pathname.startsWith("/shop") ? "active" : ""}`}
        aria-label="Shop"
      >
        <Store size={20} />
        <span>Shop</span>
      </Link>

      <Link
        href="/customize"
        className={`mm-mobile-tab-link ${pathname.startsWith("/customize") ? "active" : ""}`}
        aria-label="Design Studio"
      >
        <Palette size={20} />
        <span>Design</span>
      </Link>

      <Link
        href="/wishlist"
        className={`mm-mobile-tab-link ${pathname === "/wishlist" ? "active" : ""}`}
        aria-label="Wishlist"
      >
        <StarTabIcon />
        {slugs.length > 0 ? <span className="mm-mobile-tab-badge">{slugs.length}</span> : null}
        <span>Wishlist</span>
      </Link>

      <Link
        href="/cart"
        className={`mm-mobile-tab-link ${pathname.startsWith("/cart") ? "active" : ""}`}
        aria-label="Shopping Cart"
      >
        <CartIcon size={20} />
        {showCount ? (
          <span className="mm-mobile-tab-badge" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
        <span>Cart</span>
      </Link>
    </nav>
  );
}
