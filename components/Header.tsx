import Link from "next/link";
import Image from "next/image";
import type { Category } from "@/lib/types";
import { getSettings } from "@/lib/catalog";
import CartButton from "./CartButton";
import MobileNav from "./MobileNav";

const NAV_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/customize", label: "Design" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default async function Header({
  categories,
}: {
  categories: Category[];
}) {
  const settings = await getSettings();

  return (
    <>
      {settings.announcement ? (
        <div className="announce">
          <p className="wrap announce-inner">{settings.announcement}</p>
        </div>
      ) : null}

      <header className="header">
        <div className="wrap header-inner">
          <MobileNav categories={categories} />

          <Link href="/" className="brand" aria-label="Kingdom Custom Print — home">
            <Image
              src="/brand/kingdom-logo.svg"
              alt="Kingdom Custom Print"
              width={204}
              height={55}
              priority
              className="brand-img"
            />
          </Link>

          <nav className="desktop-nav" aria-label="Primary">
            <ul>
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
              <li className="has-menu">
                <details className="menu">
                  <summary>
                    Categories
                    <svg width="9" height="6" viewBox="0 0 12 8" aria-hidden="true">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        d="M1 1.5 6 6.5l5-5"
                      />
                    </svg>
                  </summary>
                  <div className="menu-panel">
                    <ul>
                      {categories.map((c) => (
                        <li key={c.slug}>
                          <Link href={`/shop?category=${c.slug}`}>
                            <span className="menu-name">{c.name}</span>
                            {typeof c.productCount === "number" ? (
                              <span className="menu-count">{c.productCount}</span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </li>
            </ul>
          </nav>

          <div className="header-actions">
            <Link href="/customize" className="btn btn-red btn-sm header-cta">
              Start designing
            </Link>
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}