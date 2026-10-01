import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import MobileTabBar from "./components/MobileTabBar";
import { StoreProvider } from "./lib/store";

export const metadata: Metadata = {
  title: "Kingdom Custom Print — Wear Your Identity",
  description: "Custom printed tees, hoodies, caps and merch. Design yours online."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <StoreProvider>
          <Navbar />
          <main id="main" style={{ minHeight: "60vh" }}>{children}</main>
          <Footer />
          <MobileTabBar />
        </StoreProvider>
      </body>
    </html>
  );
}
