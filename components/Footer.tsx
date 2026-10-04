import Link from "next/link";
import Image from "next/image";
import { getSettings, getCategories } from "@/lib/catalog";

const COMPANY_LINKS = [
  { href: "/about", label: "How it works" },
  { href: "/customize", label: "Design studio" },
  { href: "/shop", label: "All products" },
  { href: "/contact", label: "Contact" },
];

const HELP_LINKS = [
  { href: "/track", label: "Track order" },
  { href: "/shipping", label: "Shipping & returns" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default async function Footer() {
  const [settings, allCategories] = await Promise.all([getSettings(), getCategories()]);
  const categories = allCategories.filter((category) => category.slug === "t-shirts");
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="wrap footer-top">
        <div className="footer-brand">
          <Image
            src="/brand/kingdom-logo.png"
            alt="Kingdom Custom Print"
            width={1400}
            height={843}
            className="footer-logo"
          />
          <p className="small muted footer-note">
            Custom printed apparel, designed and printed to order. Upload your artwork or
            build a design in the browser — no minimums.
          </p>
          {settings.productionDays ? (
            <p className="small footer-lead">
              <strong>Production time:</strong> {settings.productionDays}
            </p>
          ) : null}
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="footer-heading">
            Shop
          </h2>
          <ul className="footer-grid">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop?category=${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-company">
          <h2 id="footer-company" className="footer-heading">
            Company
          </h2>
          <ul className="footer-grid">
            {COMPANY_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="footer-heading">Help</h2>
          <ul className="footer-grid">
            {HELP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="wrap footer-base">
        {settings.contactEmail || settings.contactPhone || settings.businessAddress ? (
          <address className="footer-contact small muted">
            {settings.contactEmail ? (
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            ) : null}
            {settings.contactPhone ? (
              <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`}>
                {settings.contactPhone}
              </a>
            ) : null}
            {settings.businessAddress ? <span>{settings.businessAddress}</span> : null}
          </address>
        ) : (
          <span />
        )}
        <p className="small muted">
          &copy; {year} Kingdom Custom Print. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
