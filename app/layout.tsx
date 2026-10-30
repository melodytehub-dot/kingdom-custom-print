import type { Metadata, Viewport } from "next";
import {
  Anton,
  Outfit,
  Inter,
} from "next/font/google";
import "./globals.css";
import "./site.css";
import "./home.css";
import "./shop/shop.css";
import "./product/product.css";
import "./customize/rot.css";
import "./cart/cart.css";
import "./admin/admin.css";
import "./content.css";
import "./minimog.css";
import "./refinements.css";
import { CartProvider } from "@/lib/cart-context";
import { DEFAULT_SETTINGS, getCategories, getSettings } from "@/lib/catalog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { WishlistProvider } from "@/lib/wishlist-context";
import { ToastProvider } from "@/lib/toast-context";
import MobileTabBar from "@/components/MobileTabBar";
import PageTransition from "@/components/PageTransition";
import StorefrontChrome from "@/components/StorefrontChrome";

// Primary display font for headings and emphasis
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-anton",
});

// Modern body font for readability
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

// Fallback system font for maximum compatibility
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const FONT_VARS = [
  anton.variable,
  outfit.variable,
  inter.variable,
].join(" ");

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://kingdomcustomprint.com" : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kingdom Custom Print — Custom Printed Apparel",
    template: "%s | Kingdom Custom Print",
  },
  description:
    "Design custom printed t-shirts. Upload your artwork or build a design online — add text, graphics and names & numbers — then we print it to order.",
  openGraph: {
    type: "website",
    siteName: "Kingdom Custom Print",
    url: siteUrl,
    title: "Kingdom Custom Print — Custom Printed Apparel",
    description:
      "Upload your artwork or design online. Custom printed t-shirts, made to order.",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categories, settings] = await Promise.all([
    getCategories().catch(() => []),
    getSettings().catch(() => DEFAULT_SETTINGS),
  ]);

  return (
    <html lang="en" className={FONT_VARS} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ToastProvider>
          <CartProvider>
            <WishlistProvider>
            <StorefrontChrome><Header categories={categories} announcement={settings.announcement} /></StorefrontChrome>
            <main id="main"><PageTransition>{children}</PageTransition></main>
            <StorefrontChrome><Footer /></StorefrontChrome>
            <MobileTabBar />
            </WishlistProvider>
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
