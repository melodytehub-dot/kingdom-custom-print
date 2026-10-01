import Link from "next/link";
import Image from "next/image";
import type { Category } from "@/lib/types";
import { getSettings } from "@/lib/catalog";
import CartButton from "./CartButton";
import MobileNav from "./MobileNav";
import Search from "./icons/Search";
import ChevronDown from "./icons/ChevronDown";

const NAV_LINKS = [
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
          <p className="wrap announce-inner">
            <span className="announce-dot" aria-hidden="true" />
            {settings.announcement}
          </p>
        </div>
      ) : null}

      <header className="site-header">
        <div className="wrap header-inner">
          <MobileNav categories={categories} />

          <Link href="/" className="brand" aria-label="Kingdom Custom Print — home">
            <Image
              src="/brand/kingdom-logo.png"
              alt="Kingdom Custom Print"
              width={1400}
              height={843}
              loading="eager"
              className="brand-logo"
            />
          </Link>

          <nav className="primary-nav" aria-label="Primary">
            <ul>
              <li className="nav-menu">
                <details>
                  <summary>
                    Shop
                    <ChevronDown />
                  </summary>
                  <div className="nav-panel">
                    <div className="nav-panel-head">
                      <p className="eyebrow">Shop by product</p>
                    </div>
                    <ul>
                      <li>
                        <Link href="/shop">
                          <span>All products</span>
                        </Link>
                      </li>
                      {categories.map((c) => (
                        <li key={c.slug}>
                          <Link href={`/shop?category=${c.slug}`}>
                            <span>{c.name}</span>
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
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="nav-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header-actions">
            <Link href="/shop" className="icon-btn header-search" aria-label="Browse the shop">
              <Search />
            </Link>
            <CartButton />
            <Link href="/customize" className="btn btn-red btn-sm header-cta">
              Start designing
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
