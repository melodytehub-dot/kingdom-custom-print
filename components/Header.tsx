import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/types";
import { defaultNavigationMenus, getNavigationMenus } from "@/lib/navigation-store";
import WishlistLink from "./WishlistLink";
import CartButton from "./CartButton";
import MobileNav from "./MobileNav";
import Search from "./icons/Search";

export default async function Header({
  categories,
  announcement,
  announcementLink = "",
}: {
  categories: Category[];
  announcement: string;
  announcementLink?: string;
}) {
  const menus = await getNavigationMenus().catch(() => defaultNavigationMenus());
  const mainNavLinks = menus.header;

  return (
    <header className="mm-header-wrapper">
      {announcement.trim() ? (
        <div className="mm-announcement" role="status">
          <div className="mm-announcement-track">
            {announcementLink ? (
              <>
                <Link className="mm-announcement-item" href={announcementLink}><span className="mm-announcement-dot" aria-hidden="true" />{announcement}</Link>
                <Link className="mm-announcement-item" href={announcementLink} aria-hidden="true" tabIndex={-1}><span className="mm-announcement-dot" />{announcement}</Link>
              </>
            ) : (
              <>
                <span className="mm-announcement-item"><span className="mm-announcement-dot" aria-hidden="true" />{announcement}</span>
                <span className="mm-announcement-item" aria-hidden="true"><span className="mm-announcement-dot" />{announcement}</span>
              </>
            )}
          </div>
        </div>
      ) : null}
      {/* Main header */}
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
              preload
              style={{ height: "46px", width: "auto", objectFit: "contain" }}
            />
          </Link>

          {/* Search form */}
          <div className="mm-search-wrap">
            <form action="/shop" method="GET" className="mm-search-form" role="search">
              <select name="category" className="mm-search-category" aria-label="Select product category">
                <option value="">All Categories</option>
                {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
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
            <Link href="/account" className="mm-account-action">Account</Link>
            <WishlistLink />

            <CartButton />

            <Link href="/customize" className="mm-btn mm-btn-black hide-sm" style={{ height: "42px", padding: "0 22px" }}>
              Start Designing
            </Link>
          </div>
        </div>

        {/* 3. DESKTOP NAVIGATION BAR */}
        <nav className="mm-nav-bar" aria-label="Main navigation">
          <ul className="mm-nav-list">
            {mainNavLinks.map((link) => (
              <li key={link.id} className="mm-nav-item">
                <Link
                  href={link.href}
                  className={`mm-nav-link ${link.highlight ? "highlight" : ""}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
