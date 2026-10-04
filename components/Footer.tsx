import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/lib/catalog";


export default async function Footer() {
  const settings = await getSettings();
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
              Custom apparel for your ideas, your team, and your everyday. Choose a garment and make it yours in our online design studio.
            </p>
            <Link href="/customize" className="mm-footer-studio">Make something yours ↗</Link>
          </div>

          {/* Column 2: COMPANY */}
          <div className="mm-footer-col">
            <h2>COMPANY</h2>
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
            <h2>INFORMATION</h2>
            <ul>
              <li><Link href="/admin">Admin Dashboard</Link></li>
              <li><Link href="/track">Track Order</Link></li>
              <li><Link href="/cart">My Cart</Link></li>
              <li><Link href="/wishlist">Wishlist</Link></li>
              <li><Link href="/checkout">Checkout</Link></li>
            </ul>
          </div>

          {/* Column 4: CONTACT */}
          <div className="mm-footer-col">
            <h2>CONTACT</h2>
            <ul>
              <li><Link href="/contact">Customer Service</Link></li>
              {settings.contactEmail ? <li><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></li> : null}
              {settings.contactPhone ? <li><a href={`tel:${settings.contactPhone.replace(/[^+0-9]/g, "")}`}>{settings.contactPhone}</a></li> : null}
              <li><Link href="/track">Track Your Order</Link></li>
              <li><Link href="/about">Wholesale & Teams</Link></li>
              <li><Link href="/contact">Printing Enquiries</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Column 5: SHOP CATEGORIES */}
          <div className="mm-footer-col">
            <h2>SHOP CATEGORIES</h2>
            <ul>
              <li><Link href="/shop?kind=tee">Classic T-Shirts</Link></li>
              <li><Link href="/shop?kind=longsleeve">Long Sleeve T-Shirts</Link></li>
              <li><Link href="/shop?kind=hoodie">Pullover Hoodies</Link></li>
              <li><Link href="/shop?kind=crew">Crewneck Sweatshirts</Link></li>
              <li><Link href="/customize">Customizer Studio</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mm-footer-bottom">
          <p>© {year}, Kingdom Custom Print. All Rights Reserved.</p>
          <Link href="/shipping">Shipping & returns</Link>
        </div>
      </div>
    </footer>
  );
}
