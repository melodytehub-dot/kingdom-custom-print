"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CartIcon from "./icons/CartIcon";
import Store from "./icons/Store";
import Palette from "./icons/Palette";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function HeartTabIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function MobileTabBar() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  const { count: wishlistCount } = useWishlist();
  const showCount = hydrated && count > 0;

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
        href="/shop"
        className="mm-mobile-tab-link"
        aria-label={`Wishlist (${wishlistCount} items)`}
      >
        <HeartTabIcon />
        {wishlistCount > 0 ? (
          <span className="mm-mobile-tab-badge">{wishlistCount}</span>
        ) : null}
        <span>Wishlist</span>
      </Link>

      <Link
        href="/cart"
        className={`mm-mobile-tab-link ${pathname.startsWith("/cart") ? "active" : ""}`}
        aria-label={`Cart (${count} items)`}
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
