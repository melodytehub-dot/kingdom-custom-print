"use client";

import { useWishlist } from "@/lib/wishlist-context";
import { useState } from "react";
import Link from "next/link";
import ProductPhotography from "./ProductPhotography";
import Garment from "./Garment";
import { formatUSD, lowestPrintedUnit } from "@/lib/pricing";
import type { Product } from "@/lib/types";


function StarActionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function EyeActionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const { has, toggle } = useWishlist();
  const saved = has(product.slug);
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const selectedColor = product.colors[selectedColorIdx] ?? product.colors[0];
  const baseHex = selectedColor?.hex ?? product.colors[0]?.hex ?? "#141414";

  const wasPrice = product.compareAt;
  const fromUnit = lowestPrintedUnit(product);
  const currentPrice = fromUnit !== null ? fromUnit : product.basePrice;

  return (
    <article className="mm-card">
      {/* 1. Thumbnail Media with Dual-Image Hover Swap */}
      <div className="mm-card-media">
        <Link prefetch={false} href={`/product/${product.slug}?color=${encodeURIComponent(selectedColor?.slug ?? "")}`} tabIndex={-1} aria-label={product.name}>
          {selectedColor ? (
            <>
              <ProductPhotography product={product} color={selectedColor} priority={priority} className="mm-card-img-primary" />
              <ProductPhotography product={product} color={selectedColor} view="back" className="mm-card-img-secondary" />
            </>
          ) : <Garment kind={product.kind} color={baseHex} className="mm-card-img-primary" />}
        </Link>

        {/* Floating Quick Action Buttons */}
        <div className="mm-card-actions-stack">
          <button
            type="button"
            className="mm-quick-btn"
            title={saved ? "Remove from wishlist" : "Save to wishlist"}
            aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} wishlist`}
            aria-pressed={saved}
            onClick={() => toggle(product.slug)}
          >
            <StarActionIcon />
          </button>
          <Link
            prefetch={false}
            href={`/product/${product.slug}?color=${encodeURIComponent(selectedColor?.slug ?? "")}`}
            className="mm-quick-btn"
            title="Quick View"
            aria-label="Quick View"
          >
            <EyeActionIcon />
          </Link>
        </div>


      </div>

      {/* 2. Card Body Details */}
      <div className="mm-card-body">
        <span className="mm-card-cat">
          {product.categoryName ?? "Print on Demand"}
          {product.styleCode ? ` · ${product.styleCode}` : ""}
        </span>

        <h3 className="mm-card-title">
          <Link prefetch={false} href={`/product/${product.slug}?color=${encodeURIComponent(selectedColor?.slug ?? "")}`}>{product.name}</Link>
        </h3>


        <div className="mm-card-price-row">
          <span className="tnum"><small>From </small>{formatUSD(currentPrice)}</span>
          {wasPrice ? <span className="mm-price-del tnum">{formatUSD(wasPrice)}</span> : null}
        </div>

        {/* Color Swatch Dots */}
        {product.colors.length > 0 ? (
          <div className="mm-card-swatches" aria-label="Available colors">
            {product.colors.slice(0, 6).map((c, idx) => (
              <button
                key={c.slug}
                type="button"
                className={`mm-swatch-dot ${selectedColorIdx === idx ? "active" : ""}`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
                aria-label={`Select ${c.name}`}
                aria-pressed={selectedColorIdx === idx}
                onClick={() => setSelectedColorIdx(idx)}
              />
            ))}
            {product.colors.length > 6 ? (
              <span style={{ fontSize: "11px", color: "#666", marginLeft: "2px" }}>
                +{product.colors.length - 6}
              </span>
            ) : null}
          </div>
        ) : null}
        <Link prefetch={false} href={`/customize/${product.slug}?color=${encodeURIComponent(selectedColor?.slug ?? "")}`} className="mm-card-bottom-btn">
          Customize <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
