"use client";

import { useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";

const TABS = [
  { id: "all", label: "ALL BLANKS" },
  { id: "tee", label: "T-SHIRTS" },
  { id: "fleece", label: "HOODIES & SWEATSHIRTS" },
  { id: "longsleeve", label: "LONG SLEEVE" },
];

export default function TrendingSection({ products }: { products: Product[] }) {
  const [activeTab, setActiveTab] = useState("all");

  const filtered = useMemo(() => {
    if (activeTab === "all") return products;
    if (activeTab === "tee") return products.filter((p) => p.kind === "tee");
    if (activeTab === "fleece") return products.filter((p) => p.kind === "hoodie" || p.kind === "crew" || p.categorySlug === "sweatshirts");
    if (activeTab === "longsleeve") return products.filter((p) => p.kind === "longsleeve");
    return products;
  }, [products, activeTab]);

  return (
    <section className="mm-section">
      <div className="minimog-container">
        <div className="mm-section-head">
          <span className="mm-card-cat">MINIMOG POD PICKS</span>
          <h2 className="mm-section-title">TRENDING THIS WEEK</h2>
          <p className="mm-section-sub">
            The most popular retail-quality blanks chosen by creators and independent brands.
          </p>

          {/* Interactive Filter Tabs */}
          <div className="mm-filter-tabs" role="tablist" aria-label="Product categories">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`mm-tab-pill ${isActive ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="mm-product-grid">
          {filtered.slice(0, 8).map((product, idx) => (
            <ProductCard key={product.id} product={product} priority={idx < 4} />
          ))}
        </div>
      </div>
    </section>
  );
}
