import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetail from "@/components/ProductDetail";
import ProductCard from "@/components/ProductCard";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import { formatUSD } from "@/lib/pricing";

export const revalidate = 60;

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.name} — custom printed`,
    description: product.blurb,
    openGraph: {
      title: `${product.name} | Kingdom Custom Print`,
      description: product.blurb,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const all = await getProducts({});
  const related = all
    .filter((p) => p.id !== product.id)
    .filter((p) => p.categorySlug === product.categorySlug || p.kind === product.kind)
    .slice(0, 4);

  return (
    <div className="mm-pdp-page" style={{ paddingBottom: "80px" }}>
      <div className="minimog-container" style={{ paddingTop: "20px" }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: "16px", fontSize: "13px", color: "var(--minimog-muted)" }}>
          <ol style={{ display: "flex", gap: "8px", listStyle: "none", padding: 0, margin: 0 }}>
            <li>
              <Link href="/" style={{ color: "var(--minimog-text)" }}>Home</Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/shop" style={{ color: "var(--minimog-text)" }}>Shop</Link>
            </li>
            {product.categorySlug ? (
              <>
                <li>/</li>
                <li>
                  <Link href={`/shop?category=${product.categorySlug}`} style={{ color: "var(--minimog-text)" }}>
                    {product.categoryName}
                  </Link>
                </li>
              </>
            ) : null}
            <li>/</li>
            <li aria-current="page" style={{ color: "var(--minimog-black)", fontWeight: 500 }}>{product.name}</li>
          </ol>
        </nav>
      </div>

      <div className="minimog-container" style={{ paddingTop: "20px" }}>
        <ProductDetail product={product} />
        <p className="pdp-from small muted" style={{ marginTop: "14px" }}>
          Blank priced from {formatUSD(product.basePrice)} before custom decoration.
        </p>
      </div>

      {product.description ? (
        <section className="minimog-container" style={{ paddingBlock: "50px", borderTop: "1px solid var(--minimog-border)", marginTop: "40px" }}>
          <div style={{ maxWidth: "800px" }}>
            <h2 style={{ fontSize: "24px", marginBottom: "14px", fontFamily: "var(--font-body)", fontWeight: 700 }}>About this garment blank</h2>
            <div style={{ color: "var(--minimog-text)", lineHeight: "1.7", fontSize: "15px" }}>
              <p>{product.description}</p>
            </div>
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="minimog-container" style={{ paddingBlock: "60px", borderTop: "1px solid var(--minimog-border)" }}>
          <div className="mm-section-head" style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px" }}>
            <div>
              <span className="mm-card-cat">SIMILAR FIT & STYLES</span>
              <h2 className="mm-section-title" style={{ margin: "4px 0 0" }}>RELATED BLANKS</h2>
            </div>
            <Link href="/shop" className="mm-btn mm-btn-outline" style={{ height: "38px", padding: "0 20px" }}>
              Shop all blanks
            </Link>
          </div>
          <ul className="mm-product-grid">
            {related.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} priority={i < 2} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}