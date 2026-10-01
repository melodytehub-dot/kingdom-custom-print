import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Customizer from "@/components/customizer/Customizer";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string; sizes?: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Designer" };
  return {
    title: `Design ${product.name}`,
    description: `Add text or upload artwork to the ${product.name} and place it on the front or back.`,
  };
}

/** Parses `M:4,L:2` into a size-to-quantity map. */
function parseSizes(raw: string | undefined, product: Product): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(
    product.sizes.map((s) => [s.label, 0])
  );
  if (!raw) return out;
  for (const pair of raw.split(",")) {
    const [label, qty] = pair.split(":");
    const n = Number(qty);
    if (label && Number.isFinite(n) && n > 0 && label in out) {
      out[label] = Math.min(999, Math.floor(n));
    }
  }
  return out;
}

export default async function CustomizePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { color, sizes } = await searchParams;

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const products = await getProducts({});

  return (
    <>
      <div className="wrap cust-head">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/shop">Shop</Link>
            </li>
            <li aria-current="page">Design</li>
          </ol>
        </nav>
        <h1 className="h2">Design your {product.name}</h1>
        <p className="lede">
          Add text or upload artwork, place it on the front or back, then set your size
          run. Nothing is printed until you place the order.
        </p>
      </div>

      <div className="wrap">
        <Customizer
          product={product}
          products={products}
          initialColor={color ?? ""}
          initialLines={parseSizes(sizes, product)}
        />
      </div>
    </>
  );
}