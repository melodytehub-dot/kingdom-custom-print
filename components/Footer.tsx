import Image from "next/image";
import Link from "next/link";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/catalog";
import { defaultNavigationMenus, getNavigationMenus } from "@/lib/navigation-store";


export default async function Footer() {
  const [settings, menus] = await Promise.all([
    getSettings().catch(() => DEFAULT_SETTINGS),
    getNavigationMenus().catch(() => defaultNavigationMenus()),
  ]);
  const year = new Date().getFullYear();

  return (
    <footer className="mm-footer">
      <div className="minimog-container">
        <div className="kcp-footer-lead"><div><span>Made for Your Ideas</span><p>Let&apos;s make something<br /><em>worth wearing.</em></p></div><div className="kcp-spot-action kcp-footer-lead-action"><Link href="/customize">Start designing <span aria-hidden="true">↗</span></Link><span className="kcp-spot-photo"><Image src="/img/kingdom-team.webp" alt="" fill sizes="(max-width: 700px) 42vw, 230px" /></span></div></div>
        <div className="mm-footer-grid">
          {/* Column 1: Subscribe & Brand */}
          <div className="mm-footer-col mm-footer-brand-info">
            <Link href="/" className="mm-footer-logo" aria-label="Kingdom Custom Print">
              <Image
                src="/brand/kingdom-logo.png"
                alt="Kingdom Custom Print"
                width={170}
                height={50}
                style={{ height: "44px", width: "auto", objectFit: "contain" }}
              />
            </Link>
            <p>
              {settings.footerBlurb}
            </p>
            <Link href="/customize" className="mm-footer-studio">Make something yours ↗</Link>
          </div>

          {/* Column 2: COMPANY */}
          <div className="mm-footer-company-contact">
          <div className="mm-footer-col">
            <h2>Company</h2>
            <ul>
              {menus.footerCompany.map((item) => (
                <li key={item.id}><Link href={item.href}>{item.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact follows Company on narrow screens. */}
          <div className="mm-footer-col mm-footer-contact">
            <h2>Contact</h2>
            <ul>
              <li><Link href="/contact">Customer Service</Link></li>
              {settings.contactEmail ? <li><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></li> : null}
              {settings.contactPhone ? <li><a href={`tel:${settings.contactPhone.replace(/[^+0-9]/g, "")}`}>{settings.contactPhone}</a></li> : null}
            </ul>
          </div>
          </div>

          {/* Column 3: INFORMATION */}
          <div className="mm-footer-col mm-footer-information">
            <h2>Information</h2>
            <ul>
              {menus.footerInfo.map((item) => (
                <li key={item.id}><Link href={item.href}>{item.label}</Link></li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mm-footer-bottom">
          <p>© {year}, Kingdom Custom Print. All Rights Reserved.</p>
          <p>Developed by <a href="https://melodytehub.com.ng" style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>Melodyte Hub</a></p>
          <Link href="/shipping">Shipping & returns</Link>
        </div>
      </div>
    </footer>
  );
}
