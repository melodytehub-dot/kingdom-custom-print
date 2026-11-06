import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { lowestPrintedUnit, lowestUnitPrice } from "@/lib/pricing";
import ShopSort from "@/components/ShopSort";
import { getProducts, getCategories } from "@/lib/catalog";
import { brandForProduct, PRODUCT_BRANDS } from "@/lib/product-brands";

export const revalidate = 60;

export const metadata = {
  title: "Shop apparel and merchandise",
  description:
    "Shop apparel and accessories, including ready-to-wear products and styles you can customize.",
};

const KIND_FILTERS = [
  { value: "tee", label: "Short Sleeve" },
  { value: "polo", label: "Polo Shirts" },
  { value: "longsleeve", label: "Long Sleeve" },
  { value: "fleece", label: "Hoodies & Fleece" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; kind?: string; brand?: string; sort?: string; q?: string }>;
}) {
  const params = await searchParams;
  const [allCategories, allProducts] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);
  const categories = allCategories;
  // Polo is already a precise garment-type filter below. Showing the matching
  // catalog category beside it produced two indistinguishable "Polo Shirts"
  // controls on narrow screens.
  const filterCategories = categories.filter(
    (category) => !/(^|[-\s])polo(s)?([-\s]|$)/i.test(`${category.slug} ${category.name}`)
  );

  const activeCategory = params.category ?? "";
  const activeKind = params.kind ?? "";
  const activeBrand = PRODUCT_BRANDS.find((brand) => brand.slug === params.brand)?.slug ?? "";

  const query = (params.q ?? "").trim().slice(0, 200);
  let products = allProducts;
  if (query) {
    const words = query.toLowerCase().split(/\s+/);
    products = products.filter((p) => words.every((word) => `${p.name} ${p.styleCode} ${p.blurb} ${p.categoryName} ${p.material} ${brandForProduct(p)?.name ?? ""}`.toLowerCase().includes(word)));
  }
  
  if (activeCategory) products = products.filter((p) => p.categorySlug === activeCategory);
  if (activeKind) products = products.filter((p) => activeKind === "fleece" ? p.kind === "hoodie" || p.kind === "crew" : p.kind === activeKind);
  if (activeBrand) products = products.filter((p) => brandForProduct(p)?.slug === activeBrand);

  const sort = params.sort ?? "featured";
  const sortPrice = (product: typeof allProducts[number]) => (product.saleMode === "ready-made" ? lowestUnitPrice(product) : lowestPrintedUnit(product)) ?? product.basePrice;
  products = [...products].sort((a, b) => {
    if (sort === "price-asc") return sortPrice(a) - sortPrice(b);
    if (sort === "price-desc") return sortPrice(b) - sortPrice(a);
    if (sort === "name") return a.name.localeCompare(b.name);
    return Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder;
  });

  const buildHref = (next: { category?: string; kind?: string; brand?: string; sort?: string }) => {
    const q = new URLSearchParams();
    if (query) q.set("q", query);
    const category = next.category ?? activeCategory;
    const kind = next.kind ?? activeKind;
    const brand = next.brand ?? activeBrand;
    const s = next.sort ?? sort;
    if (category) q.set("category", category);
    if (kind) q.set("kind", kind);
    if (brand) q.set("brand", brand);
    if (s && s !== "featured") q.set("sort", s);
    const qs = q.toString();
    return qs ? `/shop?${qs}` : "/shop";
  };

  const activeCategoryName = categories.find((c) => c.slug === activeCategory)?.name;
  const hasFilters = Boolean(activeCategory || activeKind || activeBrand || query);

  return (
    <div className="mm-shop-page" style={{ paddingBottom: "80px" }}>
      <div className="minimog-container" style={{ paddingTop: "30px", marginBottom: "30px" }}>
        <span className="mm-hero-tag" style={{ marginBottom: "12px" }}>
          {activeCategoryName ?? "All Products"}
        </span>
        <h1 style={{ fontSize: "36px", letterSpacing: "1px", margin: "6px 0 12px" }}>
          {query ? `Results for “${query}”` : activeCategoryName ? `Shop ${activeCategoryName}` : "Find Your Next Favorite"}
        </h1>
        <p style={{ color: "var(--minimog-text)", maxWidth: "600px", margin: 0 }}>
          Shop ready-to-wear styles or choose a blank and make it your own.
        </p>
      </div>

      <div className="minimog-container" style={{ marginBottom: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", paddingBottom: "20px", borderBottom: "1px solid var(--minimog-border)" }}>
          <div className="filter-chips" role="group" aria-label="Filter by category or product type">
            <Link
              href={buildHref({ category: "", kind: "" })}
              className={`chip${!activeCategory && !activeKind ? " is-active" : ""}`}
              style={{
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: 600,
                textTransform: "capitalize",
                background: !activeCategory && !activeKind ? "var(--minimog-black)" : "var(--minimog-bg-grey)",
                color: !activeCategory && !activeKind ? "#fff" : "var(--minimog-black)",
                borderRadius: 0,
                textDecoration: "none"
              }}
              aria-current={!activeCategory && !activeKind ? "true" : undefined}
            >
              All Products ({allProducts.length})
            </Link>
            {filterCategories.map((category) => {
              const active = activeCategory === category.slug && !activeKind;
              const catCount = allProducts.filter((p) => p.categorySlug === category.slug).length;
              return (
                <Link
                  key={category.slug}
                  href={buildHref({ category: category.slug, kind: "" })}
                  className={`chip${active ? " is-active" : ""}`}
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    background: active ? "var(--minimog-black)" : "var(--minimog-bg-grey)",
                    color: active ? "#fff" : "var(--minimog-black)",
                    borderRadius: 0,
                    textDecoration: "none"
                  }}
                  aria-current={active ? "true" : undefined}
                >
                  {category.name} ({catCount})
                </Link>
              );
            })}
            {KIND_FILTERS.map((kind) => {
              const active = activeKind === kind.value && !activeCategory;
              const kindCount = allProducts.filter((p) => kind.value === "fleece" ? p.kind === "hoodie" || p.kind === "crew" : p.kind === kind.value).length;
              return (
                <Link
                  key={kind.value}
                  href={buildHref({ category: "", kind: kind.value })}
                  className={`chip${active ? " is-active" : ""}`}
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    background: active ? "var(--minimog-black)" : "var(--minimog-bg-grey)",
                    color: active ? "#fff" : "var(--minimog-black)",
                    borderRadius: 0,
                    textDecoration: "none"
                  }}
                  aria-current={active ? "true" : undefined}
                >
                  {kind.label} ({kindCount})
                </Link>
              );
            })}
          </div>

          <ShopSort current={sort} />
        </div>
      </div>

      <nav className="minimog-container shop-brand-filter" aria-label="Shop by brand">
        <span>Brand</span>
        <Link href={buildHref({ brand: "" })} aria-current={!activeBrand ? "page" : undefined}>All brands</Link>
        {PRODUCT_BRANDS.map((brand) => <Link key={brand.slug} href={buildHref({ brand: brand.slug })} aria-current={activeBrand === brand.slug ? "page" : undefined}>{brand.name}</Link>)}
      </nav>

      {hasFilters && (activeCategory || activeKind || activeBrand) ? (
        <div className="minimog-container" style={{ marginBottom: "20px" }}>
          <Link href="/shop" style={{ fontSize: "13px", color: "var(--minimog-primary)", fontWeight: 600 }}>
            ✕ Clear all filters
          </Link>
        </div>
      ) : null}

      <section className="minimog-container" aria-label="Products">
        {products.length ? (
          <ul className={`mm-product-grid${products.length === 1 ? " is-single" : ""}`}>
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="state">
            <svg
              className="state-icon"
              viewBox="0 0 48 48"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 14h32l-3 24a4 4 0 0 1-4 3.5H15A4 4 0 0 1 11 38z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M17 20v-5a7 7 0 0 1 14 0v5" stroke="currentColor" strokeWidth="2" />
            </svg>
            <h2 className="h3">No blanks match those filters</h2>
            <p>Try a different product type, or view everything we publish.</p>
            <Link href="/shop" className="btn">
              View all blanks
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
