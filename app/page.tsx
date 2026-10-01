import Link from "next/link";
import Garment from "@/components/Garment";
import ProductCard from "@/components/ProductCard";
import ArrowRight from "@/components/icons/ArrowRight";
import { getProducts, getCategories, getSettings } from "@/lib/catalog";
import { lowestUnitPrice } from "@/lib/pricing";
import type { ProductKind } from "@/lib/types";

const STEPS = [
  {
    n: "01",
    title: "Pick your blank",
    body: "Choose the garment, colour and size run. Every blank lists its fabric weight and printable area up front.",
  },
  {
    n: "02",
    title: "Add your artwork",
    body: "Upload a file or build the design on screen. Place it on the front, back, or both, then scale and position it.",
  },
  {
    n: "03",
    title: "Confirm sizes",
    body: "Set quantities per size. Pricing updates as the total changes, so bulk runs cost less per garment.",
  },
  {
    n: "04",
    title: "Print and ship",
    body: "We check your file, print to order, and let you know when it leaves the floor.",
  },
];

const CATEGORY_GARMENT: Record<string, { kind: ProductKind; hex: string }> = {
  "t-shirts": { kind: "tee", hex: "#141414" },
  sweatshirts: { kind: "hoodie", hex: "#3A3A3C" },
  headwear: { kind: "cap", hex: "#141414" },
  drinkware: { kind: "mug", hex: "#F4F2ED" },
};

export const revalidate = 60;

export default async function HomePage() {
  const [featured, categories, settings] = await Promise.all([
    getProducts({ featuredOnly: true, limit: 8 }),
    getCategories(),
    getSettings(),
  ]);

  const all = featured.length ? featured : await getProducts({ limit: 8 });
  const showcase = all.slice(0, 4);

  return (
    <>
      {/* Hero — split editorial layout, not a full-bleed centred banner */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Print on demand</p>
            <h1 className="display">
              Your artwork,
              <br />
              on good blanks
            </h1>
            <p className="lede">
              Upload a file or design in the browser. Choose the garment, set your size
              run, and we print it to order — no minimums, no shelf stock.
            </p>
            <div className="hero-actions">
              <Link href="/customize" className="btn btn-lg">
                Start designing
                <ArrowRight />
              </Link>
              <Link href="/shop" className="btn btn-lg btn-ghost">
                Browse blanks
              </Link>
            </div>
            <ul className="hero-facts">
              <li>
                <strong>No minimums</strong>
                Single pieces ship the same way as bulk runs
              </li>
              <li>
                <strong>Print to order</strong>
                Made after you order, so nothing sits in storage
              </li>
              <li>
                <strong>{settings.productionDays}</strong>
                Timed from artwork approval
              </li>
            </ul>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-stage">
              <Garment kind="hoodie" color="#141414" className="hero-garment" />
              <div className="hero-card">
                <p className="eyebrow">Featured blank</p>
                <p className="hero-card-title h3">
                  {all[0]?.name ?? "Crown Classic Tee"}
                </p>
                {all[0] ? (
                  <p className="small muted hero-card-meta">
                    {all[0].material} · from {lowestUnitPrice(all[0]) ?? all[0].basePrice}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category entry points */}
      {categories.length ? (
        <section className="section-tight">
          <div className="wrap">
            <ul className="cat-row">
              {categories.map((c) => {
                const art = CATEGORY_GARMENT[c.slug] ?? { kind: "tee" as const, hex: "#141414" };
                return (
                  <li key={c.slug}>
                    <Link href={`/shop?category=${c.slug}`} className="cat-tile">
                      <span className="cat-art">
                        <Garment kind={art.kind} color={art.hex} />
                      </span>
                      <span className="cat-text">
                        <span className="cat-name">{c.name}</span>
                        <span className="cat-count">
                          {c.productCount} product{c.productCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* How ordering works */}
      <section className="section how">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="h2">Four steps to a finished run</h2>
            </div>
            <Link href="/about" className="link">
              Read more
              <ArrowRight />
            </Link>
          </div>

          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} className="step">
                <p className="step-n tnum">{s.n}</p>
                <h3 className="h3 step-title">{s.title}</h3>
                <p className="small muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured blanks */}
      <section className="section-tight">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Best sellers</p>
              <h2 className="h2">Blanks we print most</h2>
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

      {/* Closing band */}
      <section className="closer">
        <div className="wrap closer-grid">
          <div>
            <h2 className="h2">Have artwork ready?</h2>
            <p className="lede closer-lede">
              Skip the browser editor and upload a print-ready file directly. We will
              flag anything that will not print cleanly before production.
            </p>
          </div>
          <div className="closer-actions">
            <Link href="/customize" className="btn btn-lg">
              Open the designer
              <ArrowRight />
            </Link>
            <p className="small muted">
              Need a proof first?{" "}
              <Link href="/contact" className="link-inline">
                Send us the file
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}