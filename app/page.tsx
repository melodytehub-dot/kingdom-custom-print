import Link from "next/link";
import Image from "next/image";
import Garment from "@/components/Garment";
import ProductCard from "@/components/ProductCard";
import ArrowRight from "@/components/icons/ArrowRight";
import Check from "@/components/icons/Check";
import { getProducts, getCategories, getSettings } from "@/lib/catalog";
import { formatUSD } from "@/lib/pricing";

export const revalidate = 60;

const CATEGORY_IMAGE: Record<string, string> = {
  "t-shirts": "/img/cat-tees.jpg",
  "sweatshirts": "/img/mockups/families/hoodie/WHT_fr.webp",
  "accessories": "/img/mockups/families/cap/WHT_fr.webp",
};

const STEPS = [
  {
    n: "01",
    title: "Start from a blank",
    body: "Choose the garment, color and size run from the catalog. Every blank lists its fabric weight and printable area up front.",
  },
  {
    n: "02",
    title: "Add your design",
    body: "Upload artwork or build it on screen. Place it on the front, the back, or both, then move, scale and restyle it.",
  },
  {
    n: "03",
    title: "We check the file",
    body: "Before anything is printed, we review the artwork and flag anything that will not reproduce cleanly.",
  },
  {
    n: "04",
    title: "Printed and shipped",
    body: "Your run is printed to order and leaves the floor with tracking.",
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

const QUALITY_POINTS = [
  {
    title: "Ringspun and combed cotton",
    body: "Dense enough that artwork reads cleanly, without a backing sheet softening the linework.",
  },
  {
    title: "Side-seamed construction",
    body: "A flat surface for front, back and both-side prints that holds its shape after washing.",
  },
  {
    title: "Print areas listed up front",
    body: "Every blank shows its printable width and height before you start designing.",
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
  const [featured, categories, settings] = await Promise.all([
    getProducts({ featuredOnly: true, limit: 8 }),
    getCategories(),
    getSettings(),
  ]);

  const pool = featured.length ? featured : await getProducts({ limit: 8 });
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

      {/* Value strip */}
      <section className="value-strip" aria-label="Why order with us">
        <div className="wrap value-grid">
          <div className="value-item">
            <p className="value-label">No minimums</p>
            <p className="value-note">Order a single piece or a full run</p>
          </div>
          <div className="value-item">
            <p className="value-label">Printed to order</p>
            <p className="value-note">Made after you order, not held in stock</p>
          </div>
          <div className="value-item">
            <p className="value-label">{settings.productionDays}</p>
            <p className="value-note">Timed from artwork approval</p>
          </div>
          <div className="value-item">
            <p className="value-label">Free US shipping over {freeShipping}</p>
            <p className="value-note">Applied automatically at checkout</p>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length ? (
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">Shop by category</p>
                <h2 className="h2">Pick your canvas</h2>
              </div>
              <Link href="/shop" className="link">
                Shop all
                <ArrowRight />
              </Link>
            </div>

            <ul className="cat-row">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/shop?category=${c.slug}`} className="cat-tile">
                    <span className="cat-media">
                      <Image
                        src={CATEGORY_IMAGE[c.slug] ?? "/img/cat-tees.jpg"}
                        alt={`${c.name} category`}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className={`cat-img${c.slug !== "t-shirts" && CATEGORY_IMAGE[c.slug] ? " cat-img-product" : ""}`}
                      />
                    </span>
                    <span className="cat-foot">
                      <span className="cat-name">{c.name}</span>
                      <span className="cat-arrow" aria-hidden="true">
                        <ArrowRight />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Featured products */}
      <section className="section featured-section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Trending this week</p>
              <h2 className="h2">Ready for your idea</h2>
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

      {/* Editorial story */}
      <section className="section editorial-section">
        <div className="wrap editorial-grid">
          <div className="editorial-media">
            <Image
              src="/img/studio-editorial.png"
              alt="Three people choosing folded apparel and color swatches in a print studio"
              fill
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

      {/* How it works */}
      <section className="section process-section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="h2">From file to finished run</h2>
            </div>
            <Link href="/about" className="link">
              More detail
              <ArrowRight />
            </Link>
          </div>

          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} className="step">
                <p className="step-n tnum">{s.n}</p>
                <h3 className="h3 step-title">{s.title}</h3>
                <p className="small muted step-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Quality */}
      <section className="section quality-section">
        <div className="wrap quality-grid">
          <div className="quality-media">
            <div className="quality-shot quality-shot-a">
              <Image
                src="/img/process-rail.jpg"
                alt="Printed garments hanging on a rail"
                fill
                sizes="(max-width: 900px) 60vw, 30vw"
                className="cover-img"
              />
            </div>
            <div className="quality-shot quality-shot-b">
              <Image
                src="/img/process-folded.jpg"
                alt="Folded printed t-shirts stacked by color"
                fill
                sizes="(max-width: 900px) 60vw, 30vw"
                className="cover-img"
              />
            </div>
          </div>

          <div className="quality-copy">
            <p className="eyebrow">The blanks</p>
            <h2 className="h2">Good blanks make good prints.</h2>
            <p className="lede quality-lede">
              The print is only as good as the fabric underneath it. Every blank in the
              catalog is chosen for how it takes ink, not just how it looks on a hanger.
            </p>
            <ul className="quality-points">
              {QUALITY_POINTS.map((p) => (
                <li key={p.title}>
                  <h3>{p.title}</h3>
                  <p className="small muted">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Bulk */}
      <section className="section bulk-section">
        <div className="wrap bulk-grid">
          <div className="bulk-media">
            <Image
              src="/img/bulk.jpg"
              alt="A person carrying a packed shipping box"
              fill
              sizes="(max-width: 900px) 100vw, 45vw"
              className="cover-img"
            />
          </div>
          <div className="bulk-copy">
            <p className="eyebrow">Bulk and business</p>
            <h2 className="h2">Pricing that drops as the run grows.</h2>
            <p className="lede bulk-lede">
              Every blank carries quantity breaks — the more you order, the lower the unit
              price. Size surcharges are charged per piece, so a mixed size run is priced
              fairly.
            </p>
            <div className="bulk-actions">
              <Link href="/shop" className="btn btn-lg">
                Start a bulk order
                <ArrowRight />
              </Link>
              <Link href="/contact" className="btn btn-light btn-lg">
                Ask a question
              </Link>
            </div>
          </div>
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
          <h2 className="h2 closer-title">Open the studio and build your run.</h2>
          <p className="closer-lede">
            Upload artwork or start from a blank. No minimums, priced to order.
          </p>
          <div className="closer-actions">
            <Link href="/customize" className="btn btn-red btn-lg">
              Start designing
              <ArrowRight />
            </Link>
            <Link href="/shop" className="btn btn-white btn-lg">
              Browse blanks
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
