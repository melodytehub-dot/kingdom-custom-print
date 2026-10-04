"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CartIcon from "./icons/CartIcon";
import Store from "./icons/Store";
import Palette from "./icons/Palette";
import Chat from "./icons/Chat";
import { useCart } from "@/lib/cart-context";

const TABS = [
  { href: "/", label: "Home", Icon: HomeGlyph },
  { href: "/shop", label: "Shop", Icon: Store },
  { href: "/customize", label: "Design", Icon: Palette },
  { href: "/cart", label: "Cart", Icon: CartIcon },
  { href: "/contact", label: "Contact", Icon: Chat },
];

function HomeGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export default function MobileTabBar() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();

  return (
    <nav className="mobile-tabbar" aria-label="Quick navigation">
      <ul>
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          const showCount = href === "/cart" && hydrated && count > 0;
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}>
                <Icon />
                <span>{label}</span>
                {showCount ? (
                  <span className="mobile-tab-count tnum" aria-hidden="true">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
