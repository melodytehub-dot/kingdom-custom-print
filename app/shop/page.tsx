import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProducts, getCategories } from "@/lib/catalog";

export const revalidate = 60;

export const metadata = {
  title: "Shop custom printed blanks & apparel",
  description:
    "Blank apparel printed to order. Filter by fit, then design yours online with text, artwork and names & numbers.",
};

const KIND_FILTERS = [
  { value: "tee", label: "Short Sleeve" },
  { value: "longsleeve", label: "Long Sleeve" },
  { value: "hoodie", label: "Hoodies & Fleece" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; kind?: string; sort?: string; q?: string }>;
}) {
  const params = await searchParams;
  const [categories, allProducts] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({}).catch(() => []),
  ]);

  const activeCategory = params.category ?? "";
  const activeKind = params.kind ?? "";
  const searchQuery = (params.q ?? "").trim().toLowerCase();

  let products = allProducts;
  if (activeCategory) {
    products = products.filter((p) => p.categorySlug === activeCategory);
  }
  if (activeKind) {
    if (activeKind === "hoodie") {
      products = products.filter((p) => p.kind === "hoodie" || p.kind === "crew");
    } else {
      products = products.filter((p) => p.kind === activeKind);
    }
  }
  if (searchQuery) {
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery) ||
        (p.blurb && p.blurb.toLowerCase().includes(searchQuery)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(searchQuery)) ||
        (p.styleCode && p.styleCode.toLowerCase().includes(searchQuery))
    );
  }

  const sort = params.sort ?? "featured";
  products = [...products].sort((a, b) => {
    if (sort === "price-asc") return a.basePrice - b.basePrice;
    if (sort === "price-desc") return b.basePrice - a.basePrice;
    if (sort === "name") return a.name.localeCompare(b.name);
    return Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder;
  });

  const buildHref = (next: { category?: string; kind?: string; sort?: string; q?: string }) => {
    const q = new URLSearchParams();
    const category = next.category !== undefined ? next.category : activeCategory;
    const kind = next.kind !== undefined ? next.kind : activeKind;
    const s = next.sort !== undefined ? next.sort : sort;
    const query = next.q !== undefined ? next.q : searchQuery;

    if (category) q.set("category", category);
    if (kind) q.set("kind", kind);
    if (s && s !== "featured") q.set("sort", s);
    if (query) q.set("q", query);

    const qs = q.toString();
    return qs ? `/shop?${qs}` : "/shop";
  };

  const activeCategoryName = categories.find((c) => c.slug === activeCategory)?.name;
  const hasFilters = Boolean(activeCategory || activeKind || searchQuery);

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
          {searchQuery ? `SEARCH: "${params.q}"` : activeCategoryName ?? "ALL BLANKS & APPAREL"}
        </span>

        <h1 style={{ fontSize: "36px", letterSpacing: "1px", margin: "6px 0 12px" }}>
          {searchQuery
            ? `SEARCH RESULTS FOR "${params.q}"`
            : activeCategoryName
            ? `SHOP ${activeCategoryName.toUpperCase()}`
            : "SHOP PRINT-ON-DEMAND BLANKS"}
        </h1>

        <p style={{ color: "var(--minimog-text)", maxWidth: "600px", margin: 0 }}>
          Choose your favorite blank garment, examine available color runs and print specs, then open the online studio to customize.
        </p>

        {/* Filter Pills Bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "24px", alignItems: "center" }}>
          <Link
            href={buildHref({ category: "", kind: "", q: "" })}
            className={`mm-tab-pill ${!hasFilters ? "active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            All Blanks ({allProducts.length})
          </Link>

          {categories.map((c) => (
            <Link
              key={c.slug}
              href={buildHref({ category: activeCategory === c.slug ? "" : c.slug })}
              className={`mm-tab-pill ${activeCategory === c.slug ? "active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              {c.name}
            </Link>
          ))}

          {KIND_FILTERS.map((kf) => (
            <Link
              key={kf.value}
              href={buildHref({ kind: activeKind === kf.value ? "" : kf.value })}
              className={`mm-tab-pill ${activeKind === kf.value ? "active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              {kf.label}
            </Link>
          ))}

          {hasFilters ? (
            <Link
              href="/shop"
              style={{
                fontSize: "13px",
                color: "var(--minimog-primary)",
                fontWeight: 600,
                marginLeft: "8px",
                textDecoration: "underline",
              }}
            >
              Reset Filters ✕
            </Link>
          ) : null}
        </div>
      </div>

      {/* Main Catalog Grid */}
      <div className="minimog-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--minimog-border)",
            marginBottom: "30px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "14px", color: "var(--minimog-muted)" }}>
            Showing <strong>{products.length}</strong> {products.length === 1 ? "blank" : "blanks"}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="shop-sort" style={{ fontSize: "13px", color: "var(--minimog-text)" }}>
              Sort by:
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="shop-sort"
                defaultValue={sort}
                style={{
                  border: "1px solid var(--minimog-border)",
                  padding: "6px 28px 6px 12px",
                  fontSize: "13px",
                  background: "#fff",
                  borderRadius: "0px",
                  cursor: "pointer",
                }}
              >
                <option value="featured">Featured First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>
          </div>
        </div>

        {products.length ? (
          <ul className="mm-product-grid">
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#F9F9FB",
              border: "1px solid var(--minimog-border)",
            }}
          >
            <h3 style={{ fontSize: "20px", marginBottom: "8px" }}>No matching blanks found</h3>
            <p style={{ color: "var(--minimog-text)", marginBottom: "20px" }}>
              {searchQuery
                ? `We couldn't find any products matching "${params.q}".`
                : "Try selecting a different category or clearing filters."}
            </p>
            <Link href="/shop" className="mm-btn mm-btn-primary">
              View All Blanks
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
