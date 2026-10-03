import type { Metadata, Viewport } from "next";
import {
  Anton,
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
import { CartProvider } from "@/lib/cart-context";
import { getCategories } from "@/lib/catalog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";

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

const oswald = Oswald({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-oswald",
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bebas",
});

const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-archivo",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
});

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-pacifico",
});

const lobster = Lobster({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-lobster",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

const raleway = Raleway({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-raleway",
});

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-condensed",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-merriweather",
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-permanent-marker",
});

const FONT_VARS = [
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
    <html lang="en" className={FONT_VARS}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <CartProvider>
          <Header categories={categories} />
          <main id="main">{children}</main>
          <Footer />
          <MobileTabBar />
        </CartProvider>
      </body>
    </html>
  );
}
