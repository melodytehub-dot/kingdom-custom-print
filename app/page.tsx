import Link from "next/link";
import Image from "next/image";
import HeroSlider from "@/components/HeroSlider";
import TrendingSection from "@/components/TrendingSection";
import NewsletterForm from "@/components/NewsletterForm";
import ArrowRight from "@/components/icons/ArrowRight";
import Truck from "@/components/icons/Truck";
import Shield from "@/components/icons/Shield";
import Store from "@/components/icons/Store";
import { getProducts } from "@/lib/catalog";

export const revalidate = 60;

const POD_CATEGORIES = [
  {
    name: "T-SHIRTS",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-white.jpg",
  },
  {
    name: "HOODIES & FLEECE",
    slug: "sweatshirts",
    img: "/img/products/comfort-colors-tee.jpg",
  },
  {
    name: "HEAVYWEIGHT STREETWEAR",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-black.jpg",
  },
  {
    name: "LONG SLEEVES",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-maroon.jpg",
  },
  {
    name: "OVERSIZED TEES",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-ash.jpg",
  },
  {
    name: "TEAMWEAR & ACTIVE",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-red.jpg",
  },
];

const INSTA_IMAGES = [
  "/img/products/comfort-colors-tee.jpg",
  "/img/products/crown-classic-tee-black.jpg",
  "/img/products/crown-classic-tee-white.jpg",
  "/img/products/crown-classic-tee-maroon.jpg",
  "/img/products/crown-classic-tee-red.jpg",
  "/img/products/crown-classic-tee-ash.jpg",
];

export default async function HomePage() {
  const products = await getProducts({ limit: 20 }).catch(() => []);

  return (
    <div className="mm-home-wrapper">
      {/* 1. HERO SECTION (Interactive Multi-Slide Carousel) */}
      <HeroSlider />

      {/* 2. TRENDING THIS WEEK (Interactive Tabbed Product Grid) */}
      <TrendingSection products={products} />

      {/* 3. TWO-COLUMN SPLIT PROMO BANNERS */}
      <section style={{ paddingBottom: "80px" }}>
        <div className="minimog-container">
          <div className="mm-2col-banner">
            <Link
              href="/shop"
              className="mm-banner-box"
              style={{
                backgroundImage: "url('/img/studio-editorial.png')",
                backgroundColor: "#111",
              }}
            >
              <div className="mm-banner-content">
                <h3 className="mm-banner-title">PRINT ON DEMAND</h3>
                <p className="mm-banner-sub">Retail quality custom blanks printed and shipped on demand.</p>
                <span className="mm-banner-cta">
                  EXPLORE BLANKS <ArrowRight size={14} />
                </span>
              </div>
            </Link>

            <Link
              href="/customize"
              className="mm-banner-box"
              style={{
                backgroundImage: "url('/img/hero-editorial.png')",
                backgroundColor: "#222",
              }}
            >
              <div className="mm-banner-content">
                <h3 className="mm-banner-title">ONLINE DESIGN STUDIO</h3>
                <p className="mm-banner-sub">Upload artwork or build text designs with instant 3D garment previews.</p>
                <span className="mm-banner-cta">
                  LAUNCH STUDIO <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. SHOP BY CATEGORIES */}
      <section className="mm-section" style={{ backgroundColor: "#fbfbfb", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
        <div className="minimog-container">
          <div className="mm-section-head">
            <span className="mm-card-cat">EXPLORE OUR CATALOG</span>
            <h2 className="mm-section-title">SHOP BY CATEGORIES</h2>
            <p className="mm-section-sub">
              Browse our diverse garment catalog ready for on-demand custom printing.
            </p>
          </div>

          <div className="mm-categories-grid">
            {POD_CATEGORIES.map((cat, idx) => (
              <Link key={`${cat.name}-${idx}`} href={`/shop?category=${cat.slug}`} className="mm-category-item">
                <div className="mm-category-thumb">
                  <Image
                    src={cat.img}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 768px) 33vw, 187px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <span className="mm-category-name">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5. THREE-COLUMN PROMO BANNERS */}
      <section style={{ paddingBlock: "80px" }}>
        <div className="minimog-container">
          <div className="mm-3col-banner">
            <Link
              href="/shop?kind=tee"
              className="mm-promo-card"
              style={{
                backgroundImage: "url('/img/products/crown-classic-tee-black.jpg')",
                backgroundColor: "#181818",
              }}
            >
              <div className="mm-promo-content">
                <h3 className="mm-promo-title">THE STREETWEAR EDIT</h3>
                <span className="mm-promo-link">SHOP NOW</span>
              </div>
            </Link>

            <Link
              href="/shop?kind=hoodie"
              className="mm-promo-card"
              style={{
                backgroundImage: "url('/img/products/comfort-colors-tee.jpg')",
                backgroundColor: "#202020",
              }}
            >
              <div className="mm-promo-content">
                <h3 className="mm-promo-title">HOODIES & FLEECE</h3>
                <span className="mm-promo-link">SHOP NOW</span>
              </div>
            </Link>

            <Link
              href="/customize"
              className="mm-promo-card"
              style={{
                backgroundImage: "url('/img/products/crown-classic-tee-white.jpg')",
                backgroundColor: "#2c2c2c",
              }}
            >
              <div className="mm-promo-content">
                <h3 className="mm-promo-title">CUSTOM STUDIO</h3>
                <span className="mm-promo-link">START DESIGNING</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. HOW PRINT ON DEMAND WORKS (4-Step Process) */}
      <section className="mm-section" style={{ borderTop: "1px solid #eee", backgroundColor: "#fff" }}>
        <div className="minimog-container">
          <div className="mm-section-head">
            <span className="mm-card-cat">ZERO HEADACHES</span>
            <h2 className="mm-section-title">HOW CUSTOM PRINTING WORKS</h2>
            <p className="mm-section-sub">
              From garment selection to doorstep delivery in four simple steps.
            </p>
          </div>

          <div className="mm-steps-grid">
            <div className="mm-step-card">
              <span className="mm-step-number">01</span>
              <h4>Select Your Blank</h4>
              <p>Pick from heavyweight tees, luxury hoodies, and classic cuts in dozens of curated garment colors.</p>
            </div>
            <div className="mm-step-card">
              <span className="mm-step-number">02</span>
              <h4>Design In Studio</h4>
              <p>Upload high-resolution PNGs, vector artwork, or build typography layouts with precision printable area guides.</p>
            </div>
            <div className="mm-step-card">
              <span className="mm-step-number">03</span>
              <h4>Instant Digital Proof</h4>
              <p>Review real-time front and back mockups, inspect automated bulk quantity discounts, and submit.</p>
            </div>
            <div className="mm-step-card">
              <span className="mm-step-number">04</span>
              <h4>Printed & Delivered</h4>
              <p>We print using industry-leading direct-to-film machines and ship directly to your door.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. VALUE PROPOSITIONS / TRUST PILLARS */}
      <section className="mm-features-strip">
        <div className="minimog-container">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontSize: "28px", letterSpacing: "1px", margin: 0, textTransform: "uppercase" }}>
              BUILT FOR CREATORS, TEAMS & MODERN APPAREL BRANDS
            </h2>
          </div>

          <div className="mm-features-grid">
            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Truck size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Free Shipping Over $100</h3>
                <p>
                  Get complimentary ground delivery on all qualifying orders. Fast, trackable shipping right to your doorstep.
                </p>
              </div>
            </div>

            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Store size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Locally Printed & Operated</h3>
                <p>
                  Every garment is handled with dedicated quality assurance, vibrant ink curing, and premium packaging.
                </p>
              </div>
            </div>

            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Shield size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>100% Quality Guarantee</h3>
                <p>
                  We guarantee sharp print registration, color fidelity, and wash durability on every order.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. INSTAGRAM COMMUNITY FEED */}
      <section className="mm-section" style={{ paddingBottom: "40px" }}>
        <div className="minimog-container">
          <div className="mm-section-head" style={{ marginBottom: "20px" }}>
            <span className="mm-card-cat">SHOWCASE</span>
            <h2 className="mm-section-title" style={{ fontSize: "28px" }}>
              FOLLOW @KINGDOMCUSTOMPRINT
            </h2>
            <p className="mm-section-sub">
              Tag #KingdomCustomPrint to be featured in our community creator spotlight.
            </p>
          </div>

          <div className="mm-insta-grid">
            {INSTA_IMAGES.map((img, i) => (
              <a key={`insta-${i}`} href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="mm-insta-item">
                <Image
                  src={img}
                  alt={`Creator custom print showcase ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 33vw, 200px"
                  style={{ objectFit: "cover" }}
                />
                <div className="mm-insta-overlay">
                  <span></span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 9. NEWSLETTER SUBSCRIPTION (Interactive Client Form) */}
      <section className="mm-newsletter-section">
        <div className="minimog-container">
          <div className="mm-newsletter-box">
            <h2 className="mm-newsletter-title">STAY IN THE LOOP</h2>
            <p className="mm-newsletter-sub">
              Subscribe for exclusive print techniques, new blank drops, and 10% off your first custom order.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </section>
    </div>
  );
}
