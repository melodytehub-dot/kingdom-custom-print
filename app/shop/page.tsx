import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProducts, getCategories } from "@/lib/catalog";

export const revalidate = 60;

export const metadata = {
  title: "Shop custom printed t-shirts",
  description:
    "Blank t-shirts printed to order. Filter by fit, then design yours online with text, artwork and names & numbers.",
};

const KIND_FILTERS = [
  { value: "tee", label: "Short Sleeve" },
  { value: "longsleeve", label: "Long Sleeve" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; kind?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const [allCategories, allProducts] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug: "t-shirts" }),
  ]);
  const categories = allCategories.filter((category) => category.slug === "t-shirts");

  const activeCategory = params.category === "t-shirts" ? params.category : "";
  const activeKind = params.kind ?? "";

  let products = allProducts;
  if (activeCategory) products = products.filter((p) => p.categorySlug === activeCategory);
  if (activeKind) products = products.filter((p) => p.kind === activeKind);

  const sort = params.sort ?? "featured";
  products = [...products].sort((a, b) => {
    if (sort === "price-asc") return a.basePrice - b.basePrice;
    if (sort === "price-desc") return b.basePrice - a.basePrice;
    if (sort === "name") return a.name.localeCompare(b.name);
    return Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder;
  });

  const buildHref = (next: { category?: string; kind?: string; sort?: string }) => {
    const q = new URLSearchParams();
    const category = next.category ?? activeCategory;
    const kind = next.kind ?? activeKind;
    const s = next.sort ?? sort;
    if (category) q.set("category", category);
    if (kind) q.set("kind", kind);
    if (s && s !== "featured") q.set("sort", s);
    const qs = q.toString();
    return qs ? `/shop?${qs}` : "/shop";
  };

  const activeCategoryName = categories.find((c) => c.slug === activeCategory)?.name;
  const hasFilters = Boolean(activeCategory || activeKind);

  return (
    <div className="mm-shop-page" style={{ paddingBottom: "80px" }}>
      <div className="minimog-container" style={{ paddingTop: "30px", marginBottom: "30px" }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: "14px", fontSize: "13px", color: "var(--minimog-muted)" }}>
          <ol style={{ display: "flex", gap: "8px", listStyle: "none", padding: 0, margin: 0 }}>
            <li>
              <Link href="/" style={{ color: "var(--minimog-text)" }}>Home</Link>
            </li>
            <li>/</li>
            <li aria-current="page" style={{ color: "var(--minimog-black)", fontWeight: 500 }}>Shop Catalog</li>
          </ol>
        </nav>
        <span className="mm-hero-tag" style={{ marginBottom: "12px" }}>
          {activeCategoryName ?? "ALL BLANKS & APPAREL"}
        </span>
        <h1 style={{ fontSize: "36px", letterSpacing: "1px", margin: "6px 0 12px" }}>
          {activeCategoryName ? `SHOP ${activeCategoryName.toUpperCase()}` : "SHOP PRINT-ON-DEMAND BLANKS"}
        </h1>
        <p style={{ color: "var(--minimog-text)", maxWidth: "600px", margin: 0 }}>
          Choose your favorite blank garment, examine available color runs and print specs, then open the online studio to customize.
        </p>
      </div>

      <div className="minimog-container" style={{ marginBottom: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", paddingBottom: "20px", borderBottom: "1px solid var(--minimog-border)" }}>
          <div className="filter-chips" role="group" aria-label="Filter by category or product type" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link
              href={buildHref({ category: "", kind: "" })}
              className={`chip${!activeCategory && !activeKind ? " is-active" : ""}`}
              style={{
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: 600,
                textTransform: "uppercase",
                background: !activeCategory && !activeKind ? "var(--minimog-black)" : "var(--minimog-bg-grey)",
                color: !activeCategory && !activeKind ? "#fff" : "var(--minimog-black)",
                borderRadius: 0,
                textDecoration: "none"
              }}
              aria-current={!activeCategory && !activeKind ? "true" : undefined}
            >
              All Blanks
            </Link>
            {categories.map((category) => {
              const active = activeCategory === category.slug && !activeKind;
              return (
                <Link
                  key={category.slug}
                  href={buildHref({ category: category.slug, kind: "" })}
                  className={`chip${active ? " is-active" : ""}`}
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    background: active ? "var(--minimog-black)" : "var(--minimog-bg-grey)",
                    color: active ? "#fff" : "var(--minimog-black)",
                    borderRadius: 0,
                    textDecoration: "none"
                  }}
                  aria-current={active ? "true" : undefined}
                >
                  {category.name}
                </Link>
              );
            })}
            {KIND_FILTERS.map((kind) => {
              const active = activeKind === kind.value && !activeCategory;
              return (
                <Link
                  key={kind.value}
                  href={buildHref({ category: "", kind: kind.value })}
                  className={`chip${active ? " is-active" : ""}`}
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    background: active ? "var(--minimog-black)" : "var(--minimog-bg-grey)",
                    color: active ? "#fff" : "var(--minimog-black)",
                    borderRadius: 0,
                    textDecoration: "none"
                  }}
                  aria-current={active ? "true" : undefined}
                >
                  {kind.label}
                </Link>
              );
            })}
          </div>

          <SortControl current={sort} build={buildHref} />
        </div>
      </div>

      {hasFilters ? (
        <div className="minimog-container" style={{ marginBottom: "20px" }}>
          <Link href="/shop" style={{ fontSize: "13px", color: "var(--minimog-primary)", fontWeight: 600 }}>
            ✕ Clear all filters
          </Link>
        </div>
      ) : null}

      <section className="minimog-container" aria-label="Products">
        {products.length ? (
          <ul className="mm-product-grid">
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

function SortControl({
  current,
  build,
}: {
  current: string;
  build: (next: { sort: string }) => string;
}) {
  const options = [
    { value: "featured", label: "Featured" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "name", label: "Name A–Z" },
  ];

  return (
    <div className="sort-control">
      <span className="label sort-label" id="sort-label">
        Sort by
      </span>
      <div className="sort-menu">
        <button
          type="button"
          className="sort-toggle"
          aria-haspopup="true"
          aria-label={`Sort by ${options.find((o) => o.value === current)?.label ?? "featured"}`}
        >
          {options.find((o) => o.value === current)?.label ?? "Featured"}
          <svg width="9" height="6" viewBox="0 0 12 8" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="1.6" d="M1 1.5 6 6.5l5-5" />
          </svg>
        </button>
        <ul className="sort-list" aria-labelledby="sort-label">
          {options.map((o) => (
            <li key={o.value}>
              <Link
                href={build({ sort: o.value })}
                aria-current={o.value === current ? "true" : undefined}
              >
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
