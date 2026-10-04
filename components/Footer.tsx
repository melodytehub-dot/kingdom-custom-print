import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/lib/catalog";

function SocialIcon({ icon }: { icon: string }) {
  if (icon === "fb") {
    return (
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    );
  }
  if (icon === "tw") {
    return (
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
      </svg>
    );
  }
  if (icon === "ig") {
    return (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.25 2.67 7.9 6.43 9.34-.09-.79-.17-2 .04-2.87l1.24-5.26s-.31-.63-.31-1.56c0-1.46.85-2.55 1.9-2.55.9 0 1.33.67 1.33 1.48 0 .9-.57 2.25-.87 3.5-.25 1.05.53 1.91 1.56 1.91 1.88 0 3.32-1.98 3.32-4.83 0-2.53-1.81-4.29-4.41-4.29-3 0-4.77 2.25-4.77 4.58 0 .91.35 1.88.79 2.41a.34.34 0 0 1 .08.32c-.09.37-.29 1.18-.33 1.35-.05.22-.17.27-.39.16-1.46-.68-2.37-2.81-2.37-4.52 0-3.68 2.68-7.06 7.73-7.06 4.06 0 7.21 2.89 7.21 6.75 0 4.03-2.54 7.28-6.07 7.28-1.19 0-2.3-.62-2.69-1.35l-.73 2.79c-.27 1.02-.99 2.3-1.48 3.08A10 10 0 1 0 12 2z" />
    </svg>
  );
}

export default async function Footer() {
  const settings = await getSettings().catch(() => ({}));
  const year = new Date().getFullYear();

  return (
    <footer className="mm-footer">
      <div className="minimog-container">
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
              Premium print-on-demand studio. Millions of designs by independent artists,
              or customize your own organic blanks with zero minimums.
            </p>
            <div className="mm-footer-socials">
              <a href="#" className="mm-social-icon" aria-label="Facebook"><SocialIcon icon="fb" /></a>
              <a href="#" className="mm-social-icon" aria-label="Twitter"><SocialIcon icon="tw" /></a>
              <a href="#" className="mm-social-icon" aria-label="Instagram"><SocialIcon icon="ig" /></a>
              <a href="#" className="mm-social-icon" aria-label="Pinterest"><SocialIcon icon="pin" /></a>
            </div>
          </div>

          {/* Column 2: COMPANY */}
          <div className="mm-footer-col">
            <h4>COMPANY</h4>
            <ul>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/shipping">Shipping & Return</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Column 3: INFORMATION */}
          <div className="mm-footer-col">
            <h4>INFORMATION</h4>
            <ul>
              <li><Link href="/admin">My Account</Link></li>
              <li><Link href="/admin">Login</Link></li>
              <li><Link href="/cart">My Cart</Link></li>
              <li><Link href="/shop">Wishlist</Link></li>
              <li><Link href="/checkout">Checkout</Link></li>
            </ul>
          </div>

          {/* Column 4: CONTACT */}
          <div className="mm-footer-col">
            <h4>CONTACT</h4>
            <ul>
              <li><Link href="/contact">Customer Service</Link></li>
              <li><Link href="/track">Track Your Order</Link></li>
              <li><Link href="/about">Wholesale & Teams</Link></li>
              <li><Link href="/contact">Studio Locator</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Column 5: SHOP CATEGORIES */}
          <div className="mm-footer-col">
            <h4>SHOP CATEGORIES</h4>
            <ul>
              <li><Link href="/shop?kind=tee">Classic T-Shirts</Link></li>
              <li><Link href="/shop?kind=tee">Oversized T-Shirts</Link></li>
              <li><Link href="/shop?kind=fleece">Pullover Hoodies</Link></li>
              <li><Link href="/shop?kind=fleece">Crewneck Sweatshirts</Link></li>
              <li><Link href="/customize">Customizer Studio</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mm-footer-bottom">
          <p>© {year}, Minimog POD Store. All Rights Reserved.</p>
          <div className="mm-payment-icons">
            <span className="mm-payment-pill">VISA</span>
            <span className="mm-payment-pill">MASTERCARD</span>
            <span className="mm-payment-pill">AMEX</span>
            <span className="mm-payment-pill">PAYPAL</span>
            <span className="mm-payment-pill">APPLE PAY</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
