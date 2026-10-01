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
    <>
      <div className="wrap page-head">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/shop">Shop</Link>
            </li>
            {product.categorySlug ? (
              <li>
                <Link href={`/shop?category=${product.categorySlug}`}>
                  {product.categoryName}
                </Link>
              </li>
            ) : null}
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>
      </div>

      <div className="wrap">
        <ProductDetail product={product} />
        <p className="pdp-from small muted">
          Blank priced from {formatUSD(product.basePrice)} before printing.
        </p>
      </div>

      {product.description ? (
        <section className="section-tight pdp-detail">
          <div className="wrap">
            <hr className="rule" />
            <div className="pdp-detail-grid">
              <h2 className="h3">About this blank</h2>
              <div className="pdp-prose">
                <p>{product.description}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="section-tight">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">Also printed</p>
                <h2 className="h2">Related blanks</h2>
              </div>
              <Link href="/shop" className="link">
                Shop all
              </Link>
            </div>
            <ul className="product-grid">
              {related.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} priority={i < 2} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}