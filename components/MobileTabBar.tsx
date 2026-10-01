"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CartIcon from "./icons/CartIcon";
import Store from "./icons/Store";
import Palette from "./icons/Palette";
import Chat from "./icons/Chat";
import { useCart } from "@/lib/cart-context";

const TABS = [
  { href: "/shop", label: "Shop", Icon: Store },
  { href: "/customize", label: "Design", Icon: Palette },
  { href: "/cart", label: "Cart", Icon: CartIcon },
  { href: "/contact", label: "Contact", Icon: Chat },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();

  return (
    <nav className="mobile-tabbar" aria-label="Quick navigation">
      <ul>
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
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
