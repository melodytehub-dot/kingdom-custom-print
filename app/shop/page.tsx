import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProducts, getCategories } from "@/lib/catalog";

export const revalidate = 60;

export const metadata = {
  title: "Shop custom printed t-shirts",
  description:
    "Blank t-shirts printed to order. Filter by fit, then design yours online with text, artwork and names & numbers.",
};

const KINDS = [
  { value: "", label: "All" },
  { value: "tee", label: "T-Shirts" },
  { value: "longsleeve", label: "Long Sleeve" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; kind?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const [categories, allProducts] = await Promise.all([
    getCategories(),
    getProducts({}),
  ]);

  const activeCategory = params.category ?? "";
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
    <>
      <div className="wrap page-head">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-current="page">Shop</li>
          </ol>
        </nav>
        <p className="eyebrow">{activeCategoryName ?? "All blanks"}</p>
        <h1 className="h2">
          {activeCategoryName ?? "Shop all blanks"}
        </h1>
        <p className="lede">
          Every blank lists its fabric weight and printable area. Pick one to see the size
          run, then customize it online.
        </p>
      </div>

      <div className="wrap shop-bar">
        <div className="filter-chips" role="group" aria-label="Filter by product type">
          {KINDS.map((k) => {
            const active = activeKind === k.value;
            return (
              <Link
                key={k.value || "all"}
                href={buildHref({ kind: k.value })}
                className={`chip${active ? " is-active" : ""}`}
                aria-current={active ? "true" : undefined}
              >
                {k.label}
              </Link>
            );
          })}
        </div>

        <SortControl current={sort} build={buildHref} />
      </div>

      {hasFilters ? (
        <div className="wrap">
          <Link href="/shop" className="link clear-filters">
            Clear filters
          </Link>
        </div>
      ) : null}

      <section className="wrap section-tight" aria-label="Products">
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
    </>
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
