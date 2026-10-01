import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import "./site.css";
import "./home.css";
import "./shop/shop.css";
import "./product/product.css";
import "./customize/customizer.css";
import "./cart/cart.css";
import "./admin/admin.css";
import "./content.css";
import { CartProvider } from "@/lib/cart-context";
import { getCategories } from "@/lib/catalog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-anton",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kingdom Custom Print — Custom Printed Apparel",
    template: "%s | Kingdom Custom Print",
  },
  description:
    "Design custom printed t-shirts, hoodies, caps and mugs. Upload your artwork or build a design online, then we print it to order.",
  openGraph: {
    type: "website",
    siteName: "Kingdom Custom Print",
    url: siteUrl,
    title: "Kingdom Custom Print — Custom Printed Apparel",
    description:
      "Upload your artwork or design online. Custom printed tees, hoodies, caps and mugs.",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getCategories().catch(() => []);

  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <Header categories={categories} />
          <main id="main">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}