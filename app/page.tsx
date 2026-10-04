import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import ArrowRight from "@/components/icons/ArrowRight";
import Truck from "@/components/icons/Truck";
import Shield from "@/components/icons/Shield";
import Store from "@/components/icons/Store";
import { getProducts } from "@/lib/catalog";

export const revalidate = 60;

const POD_CATEGORIES = [
  {
    name: "MUGS",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-white.jpg",
  },
  {
    name: "PHONE CASES",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-black.jpg",
  },
  {
    name: "APPAREL",
    slug: "t-shirts",
    img: "/img/products/comfort-colors-tee.jpg",
  },
  {
    name: "HOODIES",
    slug: "t-shirts",
    img: "/img/products/comfort-colors-tee.jpg",
  },
  {
    name: "DOORMATS",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-maroon.jpg",
  },
  {
    name: "BLANKETS",
    slug: "t-shirts",
    img: "/img/products/crown-classic-tee-ash.jpg",
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
  const products = await getProducts({ categorySlug: "t-shirts", limit: 8 }).catch(() => []);
  const showcase = products.slice(0, 8);

  return (
    <div className="mm-home-wrapper">
      {/* ------------------------------------------------------------------
          1. HERO SECTION (Minimog POD Modern Slider)
          ------------------------------------------------------------------ */}
      <section className="mm-hero">
        <div className="minimog-container">
          <div className="mm-hero-grid">
            <div className="mm-hero-content">
              <span className="mm-hero-tag">PRINT ON DEMAND STUDIO</span>
              <h1 className="mm-hero-title">
                OVERSIZED PRINTED
                <br />
                T-SHIRT
              </h1>
              <p className="mm-hero-desc">
                From millions of things designed and sold by artists. Or build your own
                custom apparel online in seconds with zero minimum order quantities.
              </p>
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
              <div className="mm-hero-img-wrap">
                <Image
                  src="/img/hero-editorial.png"
                  alt="A person wearing an oversized custom printed t-shirt"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 520px"
                  style={{ objectFit: "cover" }}
                />
              </div>

              <div className="mm-hero-badge-floating">
                <div className="mm-badge-circle">
                  ✓
                </div>
                <div className="mm-badge-text">
                  <strong>100% Combed Cotton</strong>
                  <span>High-Definition DTG Printing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          2. TRENDING THIS WEEK (Product Grid)
          ------------------------------------------------------------------ */}
      <section className="mm-section">
        <div className="minimog-container">
          <div className="mm-section-head">
            <h2 className="mm-section-title">TRENDING THIS WEEK</h2>
            <p className="mm-section-sub">
              Explore our best-selling print-on-demand blanks and creator graphics, crafted for comfort and style.
            </p>
            <div className="mm-tabs">
              <button type="button" className="mm-tab-btn active">ALL DESIGNS</button>
              <button type="button" className="mm-tab-btn">CLASSIC TEES</button>
              <button type="button" className="mm-tab-btn">OVERSIZED TEES</button>
              <button type="button" className="mm-tab-btn">HOODIES & FLEECE</button>
              <button type="button" className="mm-tab-btn">NEW ARRIVALS</button>
            </div>
          </div>

          {showcase.length ? (
            <ul className="mm-product-grid">
              {showcase.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} priority={i < 4} />
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p>No products found in the catalog.</p>
            </div>
          )}

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
                backgroundImage: "url('/img/studio-editorial.png')",
                backgroundColor: "#111",
              }}
            >
              <div className="mm-banner-content">
                <h3 className="mm-banner-title">PRINT ON DEMAND</h3>
                <p className="mm-banner-sub">From millions of things designed and sold by artists.</p>
                <span className="mm-banner-cta">
                  SHOP NOW <ArrowRight size={14} />
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
          4. SHOP BY CATEGORIES
          ------------------------------------------------------------------ */}
      <section className="mm-section" style={{ backgroundColor: "#fbfbfb", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
        <div className="minimog-container">
          <div className="mm-section-head">
            <h2 className="mm-section-title">SHOP BY CATEGORIES</h2>
            <p className="mm-section-sub">
              Browse our diverse product catalog ready for on-demand custom printing.
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

      {/* ------------------------------------------------------------------
          5. THREE-COLUMN PROMO BANNERS
          ------------------------------------------------------------------ */}
      <section style={{ paddingBlock: "80px" }}>
        <div className="minimog-container">
          <div className="mm-3col-banner">
            <Link
              href="/shop"
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
              href="/shop"
              className="mm-promo-card"
              style={{
                backgroundImage: "url('/img/products/crown-classic-tee-maroon.jpg')",
                backgroundColor: "#2a1215",
              }}
            >
              <div className="mm-promo-content">
                <h3 className="mm-promo-title">BOSS LADY COLLECTION</h3>
                <span className="mm-promo-link">SHOP NOW</span>
              </div>
            </Link>

            <Link
              href="/customize"
              className="mm-promo-card"
              style={{
                backgroundImage: "url('/img/products/comfort-colors-tee.jpg')",
                backgroundColor: "#333",
              }}
            >
              <div className="mm-promo-content">
                <h3 className="mm-promo-title">CUSTOM STUDIO</h3>
                <span className="mm-promo-link">DESIGN NOW</span>
              </div>
            </Link>
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
                Printed with certified eco-friendly, water-based inks that penetrate fibers for durable, wash-resistant vibrance.
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
                Carefully packaged and dispatched with full online tracking from our print facility right to your door.
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
              PRODUCT ARTWORK IS CREATED BY TALENTED ARTISTS FROM ALL AROUND THE WORLD.
            </h2>
          </div>

          <div className="mm-features-grid">
            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Truck size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Free Shipping</h3>
                <p>
                  Get complimentary ground shipping on every order over $100. Don&apos;t love it? Send it back, on us.
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
                  Join Minimog Rewards to earn gift cards and enjoy exclusive member benefits on custom runs.
                </p>
              </div>
            </div>

            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Shield size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Money Back Guarantee</h3>
                <p>
                  We believe getting dressed should be the easiest part of your day with 100% satisfaction assurance.
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
              FOLLOW US ON INSTAGRAM
            </h2>
            <p className="mm-section-sub">
              Tag @minimog_print to be featured in our creator community spotlight.
            </p>
          </div>

          <div className="mm-insta-grid">
            {INSTA_IMAGES.map((img, i) => (
              <a key={`insta-${i}`} href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="mm-insta-item">
                <Image
                  src={img}
                  alt={`Minimog creator showcase ${i + 1}`}
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

      {/* ------------------------------------------------------------------
          9. NEWSLETTER SUBSCRIPTION
          ------------------------------------------------------------------ */}
      <section className="mm-newsletter-section">
        <div className="minimog-container">
          <div className="mm-newsletter-box">
            <h2 className="mm-newsletter-title">SUBSCRIBE</h2>
            <p className="mm-newsletter-sub">
              Our conversation is just getting started. Subscribe to receive 15% off your first custom apparel order.
            </p>
            <form
              action="/contact"
              method="GET"
              className="mm-newsletter-form"
            >
              <input
                type="email"
                placeholder="Enter your email address *"
                required
                className="mm-newsletter-input"
              />
              <button type="submit" className="mm-newsletter-btn">
                SUBMIT
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
