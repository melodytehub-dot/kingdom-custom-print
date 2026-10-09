import Link from "next/link";
import Image from "next/image";
import HeroImageSlider from "@/components/HeroImageSlider";
import HomeProducts from "@/components/HomeProducts";
import ArrowRight from "@/components/icons/ArrowRight";
import Truck from "@/components/icons/Truck";
import Shield from "@/components/icons/Shield";
import Store from "@/components/icons/Store";
import { getProducts } from "@/lib/catalog";

export const revalidate = 60;

const POD_CATEGORIES = [
  { name: "SHIRTS", href: "/shop?kind=tee", position: "0% 0%" },
  { name: "HOODIES", href: "/shop?kind=fleece", position: "100% 0%" },
  { name: "CAPS", href: "/shop?kind=cap", position: "0% 100%" },
  { name: "MERCH", href: "/shop?category=accessories", position: "100% 100%" },
];

const INSTA_IMAGES = [
  "/img/products/comfort-colors-tee.jpg",
  "/img/products/crown-classic-tee-black.jpg",
  "/img/products/crown-classic-tee-white.jpg",
  "/img/products/crown-classic-tee-maroon.jpg",
  "/img/products/crown-classic-tee-red.jpg",
  "/img/products/crown-classic-tee-ash.jpg",
];

const COLLECTIONS = [
  { title: "CUSTOM SHIRTS", href: "/shop?kind=tee", image: "shirts", alt: "Kingdom Custom Print shirt" },
  { title: "CUSTOM TOTES", href: "/shop?kind=tote", image: "totes", alt: "Black tote with a colorful floral print" },
  { title: "CAPS & HATS", href: "/shop?kind=cap", image: "caps", alt: "Printed caps in a variety of colors" },
  { title: "MUGS & MERCH", href: "/shop?category=accessories", image: "merch", alt: "Custom printed shirts, mugs and accessories" },
];

export default async function HomePage() {
  const products = await getProducts().catch(() => []);

  return (
    <div className="mm-home-wrapper">
      {/* ------------------------------------------------------------------
          1. HERO SECTION (Minimog POD Modern Slider)
          ------------------------------------------------------------------ */}
      <section className="mm-hero">
        <div className="minimog-container">
          <div className="mm-hero-grid">
            <div className="mm-hero-content">
              <div className="mm-hero-copy">
                <span className="mm-hero-tag">PRINT ON DEMAND STUDIO</span>
                <h1 className="mm-hero-title">
                  YOUR IDEAS.
                  <br />
                  MADE TO WEAR.
                </h1>
                <p className="mm-hero-desc">
                  Custom apparel for your everyday, your brand, or your team. Design it online. Make it yours.
                </p>
              </div>
              <div className="mm-hero-actions">
                <Link href="/shop" className="mm-btn mm-btn-black">
                  SHOP NOW
                </Link>
                <Link href="/customize" className="mm-btn mm-btn-outline">
                  DESIGN YOUR OWN
                </Link>
              </div>
            </div>

            <div className="mm-hero-media">
              <HeroImageSlider />
            </div>
          </div>
        </div>
      </section>

      <nav className="mm-category-strip minimog-container" aria-label="Shop by category">
        {POD_CATEGORIES.map((category) => (
          <Link key={category.name} href={category.href} className="mm-category-link">
            <span className="mm-category-art" aria-hidden="true" style={{ backgroundPosition: category.position }} />
            <span>{category.name}</span>
          </Link>
        ))}
      </nav>

      {/* Featured products */}
      <section className="mm-section">
        <div className="minimog-container">
          <div className="mm-section-head">
            <h2 className="mm-section-title">MAKE IT YOURS</h2>
            <p className="mm-section-sub">
              Find your fit. Choose a color. Create something only you could make.
            </p>

          </div>

          <HomeProducts products={products} />

          <div style={{ textAlign: "center", marginTop: "50px" }}>
            <Link href="/shop" className="mm-btn mm-btn-outline" style={{ padding: "0 45px" }}>
              VIEW ALL PRODUCTS
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          3. TWO-COLUMN SPLIT PROMO BANNERS
          ------------------------------------------------------------------ */}
      <section style={{ paddingBottom: "80px" }}>
        <div className="minimog-container">
          <div className="mm-2col-banner">
            <Link
              href="/shop"
              className="mm-banner-box"
              style={{
                backgroundColor: "#111",
              }}
            >
              <Image src="/img/shop-printing.png" alt="Custom artwork being printed on a shirt in the studio" fill sizes="(max-width: 768px) 100vw, 620px" className="mm-banner-photo" />
              <div className="mm-banner-content">
                <h3 className="mm-banner-title">PRINT ON DEMAND</h3>
                <p className="mm-banner-sub">Your artwork, printed on the apparel you love.</p>
                <span className="mm-banner-cta">
                  SHOP NOW <ArrowRight size={14} />
                </span>
              </div>
            </Link>

            <Link
              href="/customize"
              className="mm-banner-box mm-banner-box-team"
              style={{
                backgroundColor: "#222",
              }}
            >
              <span className="mm-banner-team-photo">
                <Image src="/img/kingdom-team.webp" alt="Five people wearing Kingdom Custom Print shirts" fill sizes="(max-width: 768px) 100vw, 620px" className="mm-banner-photo mm-banner-photo-team" />
              </span>
              <div className="mm-banner-content">
                <h3 className="mm-banner-title">CROSSFIT & TEAMS</h3>
                <p className="mm-banner-sub">Affiliate gear, custom uniforms and event apparel.</p>
                <span className="mm-banner-cta">
                  DESIGN YOURS <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          5. THREE-COLUMN PROMO BANNERS
          ------------------------------------------------------------------ */}
      <section style={{ paddingBlock: "80px" }}>
        <div className="minimog-container">
          <div className="mm-client-collections">
            {COLLECTIONS.map((collection) => (
              <Link key={collection.image} href={collection.href} className="mm-collection">
                <div className="mm-collection-image">
                  <Image src={`/img/collections/${collection.image}.jpg`} alt={collection.alt} fill sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 25vw" />
                </div>
                <div className="mm-collection-caption">
                  <h3>{collection.title}</h3>
                  <span>SHOP NOW <ArrowRight size={16} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          6. HOW IT WORKS (Print-On-Demand 4-Step Process)
          ------------------------------------------------------------------ */}
      <section className="mm-section" style={{ backgroundColor: "#f9f9fb" }}>
        <div className="minimog-container">
          <div className="mm-section-head">
            <h2 className="mm-section-title">HOW PRINT-ON-DEMAND WORKS</h2>
            <p className="mm-section-sub">
              From idea to delivered shirt in four straightforward steps.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "30px", marginTop: "30px" }}>
            <div style={{ background: "#fff", padding: "30px", border: "1px solid #eee", textAlign: "left" }}>
              <span style={{ fontSize: "28px", fontWeight: "700", color: "#DA3F3F", display: "block", marginBottom: "12px", fontFamily: "var(--font-display)" }}>
                01.
              </span>
              <h3 style={{ fontSize: "18px", marginBottom: "10px", fontFamily: "var(--font-body)", fontWeight: "600", textTransform: "none" }}>
                Choose Your Garment
              </h3>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                Pick from heavyweight streetwear blanks, soft ringspun tees, or cozy fleeces across 30+ colors.
              </p>
            </div>

            <div style={{ background: "#fff", padding: "30px", border: "1px solid #eee", textAlign: "left" }}>
              <span style={{ fontSize: "28px", fontWeight: "700", color: "#DA3F3F", display: "block", marginBottom: "12px", fontFamily: "var(--font-display)" }}>
                02.
              </span>
              <h3 style={{ fontSize: "18px", marginBottom: "10px", fontFamily: "var(--font-body)", fontWeight: "600", textTransform: "none" }}>
                Design in Real-Time
              </h3>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                Use our built-in live Customizer to upload graphics, arrange text layers, curve fonts, and preview front & back.
              </p>
            </div>

            <div style={{ background: "#fff", padding: "30px", border: "1px solid #eee", textAlign: "left" }}>
              <span style={{ fontSize: "28px", fontWeight: "700", color: "#DA3F3F", display: "block", marginBottom: "12px", fontFamily: "var(--font-display)" }}>
                03.
              </span>
              <h3 style={{ fontSize: "18px", marginBottom: "10px", fontFamily: "var(--font-body)", fontWeight: "600", textTransform: "none" }}>
                Precision DTG Print
              </h3>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                We prepare your artwork for printing and produce your garments to order.
              </p>
            </div>

            <div style={{ background: "#fff", padding: "30px", border: "1px solid #eee", textAlign: "left" }}>
              <span style={{ fontSize: "28px", fontWeight: "700", color: "#DA3F3F", display: "block", marginBottom: "12px", fontFamily: "var(--font-display)" }}>
                04.
              </span>
              <h3 style={{ fontSize: "18px", marginBottom: "10px", fontFamily: "var(--font-body)", fontWeight: "600", textTransform: "none" }}>
                Delivered With Tracking
              </h3>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                Use your order reference to check progress as your garments move through production and shipping.
              </p>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <Link href="/customize" className="mm-btn mm-btn-red" style={{ padding: "0 40px" }}>
              OPEN DESIGN STUDIO NOW
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          7. VALUE PROPOSITIONS / TRUST PILLARS
          ------------------------------------------------------------------ */}
      <section className="mm-features-strip">
        <div className="minimog-container">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontSize: "30px", letterSpacing: "1px", margin: 0 }}>
              YOUR PROJECT. OUR ATTENTION TO DETAIL.
            </h2>
          </div>

          <div className="mm-features-grid">
            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Truck size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Clear delivery options</h3>
                <p>
                  Review shipping at checkout and follow your order from production to delivery.
                </p>
              </div>
            </div>

            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Store size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Locally Owned</h3>
                <p>
                  Custom apparel for businesses, creative projects, events, and teams. Talk to us about your next run.
                </p>
              </div>
            </div>

            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Shield size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Here to help</h3>
                <p>
                  Questions about a garment or your artwork? Our team can help you plan your print.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          8. INSTAGRAM COMMUNITY FEED
          ------------------------------------------------------------------ */}
      <section className="mm-section" style={{ paddingBottom: "40px" }}>
        <div className="minimog-container">
          <div className="mm-section-head" style={{ marginBottom: "20px" }}>
            <h2 className="mm-section-title" style={{ fontSize: "28px" }}>
              COLOR YOUR NEXT PROJECT
            </h2>
            <p className="mm-section-sub">
              Explore garment colors and build a look that feels like you.
            </p>
          </div>

          <div className="mm-insta-grid">
            {INSTA_IMAGES.map((img, i) => (
              <Link key={`insta-${i}`} href="/shop" className="mm-insta-item">
                <Image
                  src={img}
                  alt={`Kingdom Custom Print garment inspiration ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 33vw, 200px"
                  style={{ objectFit: "cover" }}
                />
                <div className="mm-insta-overlay">
                  <span>Explore ↗</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          9. NEWSLETTER SUBSCRIPTION
          ------------------------------------------------------------------ */}
      <section className="mm-newsletter-section">
        <div className="minimog-container">
          <div className="mm-newsletter-box">
            <h2 className="mm-newsletter-title">LET’S MAKE SOMETHING GREAT</h2>
            <p className="mm-newsletter-sub">
              Planning apparel for your business or team? Tell us about your project and we’ll help you get started.
            </p>
            <Link href="/contact" className="mm-btn mm-btn-black">Talk to our team</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
