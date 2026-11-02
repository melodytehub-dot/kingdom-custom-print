import Link from "next/link";
import Image from "next/image";
import HeroImageSlider from "@/components/HeroImageSlider";
import HomeProducts from "@/components/HomeProducts";
import ResumeDesignPrompt from "@/components/ResumeDesignPrompt";
import ArrowRight from "@/components/icons/ArrowRight";
import Truck from "@/components/icons/Truck";
import Shield from "@/components/icons/Shield";
import Store from "@/components/icons/Store";
import { getProducts, getSettings, DEFAULT_SETTINGS } from "@/lib/catalog";
import { heroImage } from "@/lib/hero-slides";

export const revalidate = 60;

const POD_CATEGORIES = [
  { name: "SHIRTS", href: "/shop?kind=tee", image: "/img/category-prints/shirts.webp" },
  { name: "POLOS", href: "/shop?kind=polo", image: "/img/category-prints/polos.webp" },
  { name: "HOODIES", href: "/shop?kind=fleece", image: "/img/category-prints/hoodies.webp" },
  { name: "CAPS", href: "/shop?kind=cap", image: "/img/category-prints/caps.webp" },
  { name: "TOTES", href: "/shop?kind=tote", image: "/img/category-prints/totes.webp" },
  { name: "MERCH", href: "/shop?kind=mug", image: "/img/category-prints/merch.webp" },
];

const INSTA_IMAGES = [
  "/img/printed-catalog/crown-classic-tee/black.webp",
  "/img/printed-catalog/crown-classic-tee/white.webp",
  "/img/printed-catalog/classic-pique-polo/black.webp",
  "/img/printed-catalog/premium-pullover-hoodie/black.webp",
  "/img/printed-catalog/canvas-tote/natural.webp",
  "/img/printed-catalog/five-panel-cap/black.webp",
];

const COLLECTIONS = [
  { title: "CUSTOM SHIRTS", href: "/shop?kind=tee", image: "shirts", alt: "Kingdom Custom Print shirt" },
  { title: "CUSTOM TOTES", href: "/shop?kind=tote", image: "totes", alt: "Black tote with a colorful floral print" },
  { title: "CAPS & HATS", href: "/shop?kind=cap", image: "caps", alt: "Printed caps in a variety of colors" },
  { title: "MUGS & MERCH", href: "/shop?category=accessories", image: "merch", alt: "Custom printed shirts, mugs and accessories" },
];

export default async function HomePage() {
  const [products, settings] = await Promise.all([getProducts().catch(() => []), getSettings().catch(() => DEFAULT_SETTINGS)]);

  return (
    <div className="mm-home-wrapper">
      <ResumeDesignPrompt />
      {/* ------------------------------------------------------------------
          1. HERO SECTION (Minimog POD Modern Slider)
          ------------------------------------------------------------------ */}
      <section className="mm-hero">
        <div className="minimog-container">
          <div className="mm-hero-grid">
            <div className="mm-hero-content">
              <div className="mm-hero-copy">
                <span className="mm-hero-tag">{settings.heroLabel}</span>
                <h1 className="mm-hero-title">
                  {settings.heroHeadlineTop}
                  <br />
                  {settings.heroHeadlineBottom}
                </h1>
                <p className="mm-hero-desc">
                  {settings.heroDescription}
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
              <HeroImageSlider slides={[heroImage(settings.heroImage1), heroImage(settings.heroImage2), heroImage(settings.heroImage3)]} />
            </div>
          </div>
        </div>
      </section>

      <nav className="mm-category-strip minimog-container" aria-label="Shop by category">
        {POD_CATEGORIES.map((category) => (
          <Link key={category.name} href={category.href} className="mm-category-link">
            <span className="mm-category-art" aria-hidden="true" style={{ backgroundImage: `url(${category.image})` }} />
            <span>{category.name}</span>
          </Link>
        ))}
      </nav>

      <section className="mm-colour-intro minimog-container" aria-label="Make it yours">
        <div className="mm-colour-intro-inner">
          <div className="mm-colour-intro-copy">
            <span className="mm-colour-kicker">MADE FOR YOUR IDEAS</span>
            <h2>Your canvas.<br />Your creativity.</h2>
            <p>From everyday tees to totes and caps, find your starting point and make it your own.</p>
            <Link href="/shop" className="mm-colour-link">EXPLORE PRODUCTS <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="mm-start-section minimog-container" aria-label="Ways to get started">
        <div className="mm-start-heading"><span>YOUR NEXT IDEA STARTS HERE</span><h2>Made for the moments that matter.</h2><p>Make something personal, or bring your whole team together.</p></div>
        <div className="mm-start-links">
          <Link href="/customize"><span>01</span><strong>Design it online</strong><small>Add your artwork and make it yours.</small><ArrowRight size={18} /></Link>
          <Link href="/contact"><span>02</span><strong>Plan a group order</strong><small>Tell us what you have in mind.</small><ArrowRight size={18} /></Link>
        </div>
      </section>
      <section className="mm-section">
        <div className="minimog-container">
          <div className="mm-section-head">
            <h2 className="mm-section-title">{settings.homeProductsTitle}</h2>
            <p className="mm-section-sub">
              {settings.homeProductsDescription}
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
                <p className="mm-banner-sub">Upload your file or design in the browser. We print and ship.</p>
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
                <Image src="/img/kingdom-team.webp" alt="Five people wearing Kingdom Custom Print shirts" fill sizes="(max-width: 768px) 100vw, 620px" className="mm-banner-photo mm-banner-photo-team" unoptimized />
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
              Pick a garment, add artwork in the browser, and we handle the rest.
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
                Pick from heavyweight streetwear blanks, soft ringspun tees, or cozy fleeces in the colors available for each style.
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
                Review Your Design
              </h3>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                Check your artwork, colors, and quantities before placing your order.
              </p>
            </div>

            <div style={{ background: "#fff", padding: "30px", border: "1px solid #eee", textAlign: "left" }}>
              <span style={{ fontSize: "28px", fontWeight: "700", color: "#DA3F3F", display: "block", marginBottom: "12px", fontFamily: "var(--font-display)" }}>
                04.
              </span>
              <h3 style={{ fontSize: "18px", marginBottom: "10px", fontFamily: "var(--font-body)", fontWeight: "600", textTransform: "none" }}>
                Keep Your Reference
              </h3>
              <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
                Keep your order reference handy if you have a question about your order.
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
                  Review the shipping details and cost before placing your order.
                </p>
              </div>
            </div>

            <div className="mm-feature-box">
              <div className="mm-feature-icon">
                <Store size={24} />
              </div>
              <div className="mm-feature-body">
                <h3>Built for custom runs</h3>
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
              BROWSE GARMENTS AND COLORS
            </h2>
            <p className="mm-section-sub">
              30+ color options across our most popular blanks. Find the right fit before you design.
            </p>
          </div>

          <div className="mm-insta-grid">
            {INSTA_IMAGES.map((img, i) => (
              <Link key={`insta-${i}`} href="/shop" className="mm-insta-item">
                <Image
                  src={`${img}?v=blank-1`}
                  alt={`Blank garment ready to customize ${i + 1}`}
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
            <h2 className="mm-newsletter-title">{settings.homeContactTitle}</h2>
            <p className="mm-newsletter-sub">
              {settings.homeContactDescription}
            </p>
            <Link href="/contact" className="mm-btn mm-btn-black">Get in touch</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
