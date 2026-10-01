import Link from "next/link";
import Image from "next/image";
import { getSettings, getCategories } from "@/lib/catalog";

const HELP_LINKS = [
  { href: "/about", label: "How it works" },
  { href: "/contact", label: "Contact" },
  { href: "/shipping", label: "Shipping & returns" },
  { href: "/faq", label: "FAQ" },
];

export default async function Footer() {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Image
            src="/brand/kingdom-logo.svg"
            alt="Kingdom Custom Print"
            width={200}
            height={54}
            className="footer-logo"
          />
          <p className="small muted footer-note">
            Custom printed apparel, designed and printed to order. Upload your artwork or
            build a design in the browser.
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
          <ul>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/shop?category=${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="footer-heading">
            Help
          </h2>
          <ul>
            {HELP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="footer-heading">Contact</h2>
          <ul className="footer-contact">
            {settings.contactEmail ? (
              <li>
                <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
              </li>
            ) : null}
            {settings.contactPhone ? (
              <li>
                <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`}>
                  {settings.contactPhone}
                </a>
              </li>
            ) : null}
            {settings.businessAddress ? (
              <li className="muted">{settings.businessAddress}</li>
            ) : null}
            {!settings.contactEmail && !settings.contactPhone && !settings.businessAddress ? (
              <li className="muted">
                Contact details are not published yet.{" "}
                <Link href="/contact" className="link-inline">
                  Send a message
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="wrap footer-base">
        <p className="small muted">
          &copy; {year} Kingdom Custom Print. All rights reserved.
        </p>
        <ul className="footer-legal">
          <li>
            <Link href="/privacy">Privacy</Link>
          </li>
          <li>
            <Link href="/terms">Terms</Link>
          </li>
          <li>
            <Link href="/admin">Admin</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}