import type { Metadata, Viewport } from "next";
import {
  Anton,
  Outfit,
  Inter,
  Oswald,
  Bebas_Neue,
  Archivo_Black,
  Playfair_Display,
  Pacifico,
  Lobster,
  Montserrat,
  Raleway,
  Roboto_Condensed,
  Merriweather,
  Permanent_Marker,
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
import { getCategories } from "@/lib/catalog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { WishlistProvider } from "@/lib/wishlist-context";
import MobileTabBar from "@/components/MobileTabBar";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

const inter = Inter({
  preload: false,
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

const oswald = Oswald({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-oswald",
});

const bebas = Bebas_Neue({
  preload: false,
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bebas",
});

const archivo = Archivo_Black({
  preload: false,
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-archivo",
});

const playfair = Playfair_Display({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
});

const pacifico = Pacifico({
  preload: false,
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-pacifico",
});

const lobster = Lobster({
  preload: false,
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-lobster",
});

const montserrat = Montserrat({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

const raleway = Raleway({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-raleway",
});

const robotoCondensed = Roboto_Condensed({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-condensed",
});

const merriweather = Merriweather({
  preload: false,
  subsets: ["latin"],
  display: "swap",
  variable: "--font-merriweather",
});

const permanentMarker = Permanent_Marker({
  preload: false,
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-permanent-marker",
});

const FONT_VARS = [
  outfit.variable,
  inter.variable,
  anton.variable,
  oswald.variable,
  bebas.variable,
  archivo.variable,
  playfair.variable,
  pacifico.variable,
  lobster.variable,
  montserrat.variable,
  raleway.variable,
  robotoCondensed.variable,
  merriweather.variable,
  permanentMarker.variable,
].join(" ");

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
  const categories = await getCategories().catch(() => []);

  return (
    <html lang="en" className={FONT_VARS}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <WishlistProvider>
          <Header categories={categories} />
          <main id="main">{children}</main>
          <Footer />
          <MobileTabBar />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
