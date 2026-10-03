import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Customizer from "@/components/customizer/Customizer";
import { getProductBySlug, getProducts, getSettings } from "@/lib/catalog";
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

  const [products, settings] = await Promise.all([
    getProducts({}),
    getSettings().catch(() => null),
  ]);

  return (
    <div className="studio-page">
      <h1 className="sr-only">Design your {product.name}</h1>
      <Customizer
        product={product}
        products={products}
        initialColor={color ?? ""}
        initialLines={parseSizes(sizes, product)}
        contactPhone={settings?.contactPhone ?? ""}
      />
    </div>
  );
}