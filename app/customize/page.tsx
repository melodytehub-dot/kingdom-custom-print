import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Design your own apparel",
  description:
    "Pick a blank, add text or upload artwork, place it on the front or back, and set your size run.",
};

export default async function CustomizeStartPage() {
  const products = await getProducts({});

  return (
    <>
      <div className="wrap cust-head">
        <p className="eyebrow">Online designer</p>
        <h1 className="h2">Choose a blank to start designing</h1>
        <p className="lede">
          Pick the garment you want printed. The designer lets you add text, upload
          artwork, position both on the front or back, and set quantities per size.
        </p>
      </div>

      <section className="wrap section-tight" aria-label="Choose a blank">
        {products.length ? (
          <ul className="product-grid">
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="state">
            <h2 className="h3">No blanks are published yet</h2>
            <p>Once products are added in the admin dashboard they will appear here.</p>
            <Link href="/shop" className="btn">
              Go to the shop
            </Link>
          </div>
        )}
      </section>
    </>
  );
}