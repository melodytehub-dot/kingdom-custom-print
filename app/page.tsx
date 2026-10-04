import Link from "next/link";
import Image from "next/image";
import Garment from "@/components/Garment";
import ProductCard from "@/components/ProductCard";
import ArrowRight from "@/components/icons/ArrowRight";
import Check from "@/components/icons/Check";
import { getProducts, getSettings } from "@/lib/catalog";
import { formatUSD } from "@/lib/pricing";

export const revalidate = 60;

const SHIRT_CATEGORIES = [
  {
    slug: "tee",
    name: "Classic Tees",
    description: "Timeless fits for everyday wear.",
    image: "/img/products/crown-classic-tee-black.jpg",
  },
  {
    slug: "tee",
    name: "Oversized Tees",
    description: "Relaxed fits with a modern look.",
    image: "/img/products/comfort-colors-tee.jpg",
  },
  {
    slug: "tee",
    name: "Youth Tees",
    description: "Comfort for the next generation.",
    image: "/img/mockups/families/youth/WHT_fr.webp",
  },
];

const STUDIO_FEATURES = [
  {
    title: "Front and back",
    body: "Design both sides of the garment and switch between them in the live preview.",
  },
  {
    title: "Text and artwork layers",
    body: "Move, scale, rotate and restyle every layer, then remove it again in one tap.",
  },
  {
    title: "Pricing as you go",
    body: "The price updates the moment you change the quantity or the size run.",
  },
];

function TypeGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 5V3h12v2M9 3v12M6.5 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 12V3m0 0L5.5 6.5M9 3l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v2.2A1.8 1.8 0 0 0 4.8 16h8.4A1.8 1.8 0 0 0 15 14.2V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArtGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="3.5" width="12" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6.8" cy="7.3" r="1.2" fill="currentColor" />
      <path d="m4 13 3.6-3.4L11 12.6l2-1.8 1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RotateGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M14.5 9a5.5 5.5 0 1 1-1.8-4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.8 2.6v3.2h-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function HomePage() {
  const [featured, settings] = await Promise.all([
    getProducts({ featuredOnly: true, categorySlug: "t-shirts", limit: 8 }),
    getSettings(),
  ]);

  const pool = featured.length
    ? featured
    : await getProducts({ categorySlug: "t-shirts", limit: 8 });
  const showcase = pool.slice(0, 8);
  const freeShipping = formatUSD(settings.freeShippingThreshold);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-red">Custom print on demand</p>
            <h1 className="display hero-title">
              Oversized printed
              <br />
              t-shirts.
            </h1>
            <p className="lede hero-lede">
              Create something worth wearing. Choose your blank, add your artwork, and make
              one piece or a full run — printed to order with no minimums.
            </p>
            <div className="hero-actions">
              <Link href="/customize" className="btn btn-red btn-lg">
                Design yours
                <ArrowRight />
              </Link>
              <Link href="/shop" className="btn btn-outline-light btn-lg">
                Shop the collection
              </Link>
            </div>
          </div>

          <div className="hero-media">
            <Image
              src="/img/hero-editorial.png"
              alt="A person wearing a clean oversized cotton t-shirt in a bright studio"
              fill
              preload
              sizes="(max-width: 900px) 100vw, 50vw"
              className="hero-img"
            />
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="section featured-section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Trending this week</p>
              <h2 className="h2">T-shirts made to be yours</h2>
            </div>
            <Link href="/shop" className="link">
              Shop all
              <ArrowRight />
            </Link>
          </div>

          {showcase.length ? (
            <ul className="product-grid">
              {showcase.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} priority={i < 2} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="panel panel-pad">
              <p className="muted">
                No blanks are published yet. Add products from the admin dashboard to
                populate the storefront.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="section category-section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Shop by fit</p>
              <h2 className="h2">Find your favorite tee</h2>
            </div>
            <Link href="/shop" className="link">View all t-shirts <ArrowRight /></Link>
          </div>
          <ul className="cat-row">
            {SHIRT_CATEGORIES.map((c, index) => (
              <li key={`${c.name}-${index}`}>
                <Link href="/shop?category=t-shirts" className="cat-tile">
                  <span className="cat-media">
                    <Image src={c.image} alt={`${c.name} category`} fill loading="eager" sizes="(max-width: 640px) 82vw, 30vw" className={`cat-img${index > 0 ? " cat-img-product" : ""}`} />
                  </span>
                  <span className="cat-foot">
                    <span><span className="cat-name">{c.name}</span><span className="cat-description">{c.description}</span></span>
                    <span className="cat-arrow" aria-hidden="true"><ArrowRight /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Editorial story */}
      <section className="section editorial-section">
        <div className="wrap editorial-grid">
          <div className="editorial-media">
            <Image
              src="/img/studio-editorial.png"
              alt="Three people choosing folded apparel and color swatches in a print studio"
              fill
              loading="eager"
              sizes="(max-width: 760px) 100vw, 55vw"
              className="cover-img"
            />
          </div>
          <div className="editorial-copy">
            <p className="eyebrow">Made for your people</p>
            <h2 className="h2">Good ideas look better together.</h2>
            <p className="lede">
              From a one-off gift to a full team run, we make the process feel simple: pick
              a blank, build your design, and see the finished piece before you order.
            </p>
            <Link href="/customize" className="btn btn-lg">
              Start creating
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Design studio */}
      <section className="section studio-section">
        <div className="wrap studio-grid">
          <div className="studio-copy">
            <p className="eyebrow">The design studio</p>
            <h2 className="h2">Upload art. Add text. See it before you buy.</h2>
            <p className="lede studio-lede">
              The studio runs in the browser, so you can build the design on screen and watch
              the price change with the run. Nothing is committed until you add it to the cart.
            </p>

            <ul className="studio-features">
              {STUDIO_FEATURES.map((f) => (
                <li key={f.title}>
                  <span className="studio-feature-mark" aria-hidden="true">
                    <Check size={15} />
                  </span>
                  <span>
                    <strong>{f.title}</strong>
                    <span className="studio-feature-body">{f.body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <Link href="/customize" className="btn btn-red btn-lg studio-cta">
              Open the design studio
              <ArrowRight />
            </Link>
          </div>

          <div className="studio-mock" aria-hidden="true">
            <div className="studio-mock-bar">
              <span className="studio-step is-active">
                <span className="studio-step-n">1</span> Design
              </span>
              <span className="studio-step">
                <span className="studio-step-n">2</span> Quantity
              </span>
              <span className="studio-step">
                <span className="studio-step-n">3</span> Review
              </span>
            </div>
            <div className="studio-stage">
              <Garment kind="tee" color="#17171a" className="studio-garment" />
              <div className="studio-tools">
                <span className="studio-chip">
                  <TypeGlyph /> Add text
                </span>
                <span className="studio-chip">
                  <UploadGlyph /> Upload art
                </span>
                <span className="studio-chip">
                  <ArtGlyph /> Add art
                </span>
              </div>
              <span className="studio-rotate">
                <RotateGlyph /> Rotate
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section benefits-section" aria-label="Kingdom Custom Print benefits">
        <div className="wrap benefits-grid">
          <article className="benefit-card">
            <Image src="/img/feature-blanks.png" alt="Premium t-shirts folded by color" fill loading="eager" sizes="(max-width: 760px) 100vw, 33vw" className="benefit-image" />
            <div className="benefit-copy"><span className="benefit-icon"><Check size={18} /></span><h3>Premium blanks</h3><p>Comfortable t-shirts selected to hold their shape and take a clean print.</p></div>
          </article>
          <article className="benefit-card">
            <Image src="/img/feature-studio.png" alt="Screen printing press in a local print studio" fill loading="eager" sizes="(max-width: 760px) 100vw, 33vw" className="benefit-image" />
            <div className="benefit-copy"><span className="benefit-icon"><Check size={18} /></span><h3>Printed with care</h3><p>Every order moves from your browser to a real print workflow with care.</p></div>
          </article>
          <article className="benefit-card">
            <Image src="/img/feature-finish.png" alt="Finished custom printed t-shirt ready to ship" fill loading="eager" sizes="(max-width: 760px) 100vw, 33vw" className="benefit-image" />
            <div className="benefit-copy"><span className="benefit-icon"><Check size={18} /></span><h3>Ready to wear</h3><p>Preview the front or back, then get free US shipping over {freeShipping}.</p></div>
          </article>
        </div>
      </section>

      {/* Closing band */}
      <section className="closer">
        <Image
          src="/img/cta-band.jpg"
          alt=""
          fill
          sizes="100vw"
          className="closer-bg"
        />
        <div className="closer-overlay" aria-hidden="true" />
        <div className="wrap closer-inner">
          <p className="eyebrow closer-eyebrow">Ready when you are</p>
          <h2 className="h2 closer-title">Your next favorite t-shirt starts here.</h2>
          <p className="closer-lede">
            Upload artwork or start from a blank. No minimums, priced to order.
          </p>
          <div className="closer-actions">
            <Link href="/customize" className="btn btn-red btn-lg">
              Start designing
              <ArrowRight />
            </Link>
            <Link href="/shop" className="btn btn-white btn-lg">
              Shop t-shirts
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
