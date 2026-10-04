"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Garment from "./Garment";
import QuickViewModal from "./QuickViewModal";
import { formatUSD, lowestPrintedUnit } from "@/lib/pricing";
import { hasDedicatedMockupFamily, mockupsForProduct } from "@/lib/mockups";
import { useWishlist } from "@/lib/wishlist-context";
import type { Product } from "@/lib/types";

function StarRating() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "2px", color: "#f5a623", fontSize: "12px" }}>
      <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
      <span style={{ color: "#888", fontSize: "11px", marginLeft: "4px" }}>(5.0)</span>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="#DA3F3F" stroke="#DA3F3F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
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

function PaintBrushIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
      <path d="M9 8c-2 3-4 3.5-7 4l8 8c.5-3 1-5 4-7" />
      <path d="M14.5 17.5 4.5 15" />
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
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const { isWishlisted, toggleWishlist } = useWishlist();

  const selectedColor = product.colors[selectedColorIdx] ?? product.colors[0];
  const baseHex = selectedColor?.hex ?? product.colors[0]?.hex ?? "#141414";

  const allMockups = hasDedicatedMockupFamily(product) ? mockupsForProduct(product) : [];
  const currentMockup = allMockups.find((m) => m.slug === selectedColor?.slug) ?? allMockups[0];

  const frontImgUrl = currentMockup?.front ?? product.images[0]?.url;
  const backImgUrl = currentMockup?.back ?? product.images[1]?.url ?? frontImgUrl;

  const wasPrice = product.compareAt;
  const fromUnit = lowestPrintedUnit(product);
  const currentPrice = fromUnit !== null ? fromUnit : product.basePrice;
  const wishlisted = isWishlisted(product.id);

  return (
    <>
      <article className="mm-card">
        {/* 1. Thumbnail Media with Dual-Image Hover Swap */}
        <div className="mm-card-media">
          <Link href={`/product/${product.slug}`} tabIndex={-1} aria-label={product.name}>
            {frontImgUrl ? (
              <>
                <Image
                  src={frontImgUrl}
                  alt={`${product.name} front view`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
                  loading={priority ? "eager" : "lazy"}
                  className="mm-card-img-primary"
                />
                {backImgUrl && backImgUrl !== frontImgUrl ? (
                  <Image
                    src={backImgUrl}
                    alt={`${product.name} back view`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
                    loading="lazy"
                    className="mm-card-img-secondary"
                  />
                ) : null}
              </>
            ) : (
              <Garment kind={product.kind} color={baseHex} className="mm-card-img-primary" />
            )}
          </Link>

          {/* Badges */}
          <div className="mm-card-badges">
            {wasPrice ? (
              <span className="mm-flag-badge mm-flag-sale">
                Sale -{Math.round(((wasPrice - product.basePrice) / wasPrice) * 100)}%
              </span>
            ) : null}
            {product.featured ? <span className="mm-flag-badge mm-flag-hot">Hot</span> : null}
            <span className="mm-flag-badge mm-flag-custom">POD Blank</span>
          </div>

          {/* Floating Action Buttons: Wishlist & Quick View */}
          <div className="mm-card-actions-stack">
            <button
              type="button"
              className={`mm-quick-btn ${wishlisted ? "is-wishlisted" : ""}`}
              title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
              aria-label={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
              onClick={(e) => {
                e.preventDefault();
                toggleWishlist(product);
              }}
            >
              <HeartIcon filled={wishlisted} />
            </button>
            <button
              type="button"
              className="mm-quick-btn"
              title="Quick View"
              aria-label="Quick View"
              onClick={(e) => {
                e.preventDefault();
                setQuickViewOpen(true);
              }}
            >
              <EyeActionIcon />
            </button>
          </div>
        </div>

        {/* 2. Card Body Details */}
        <div className="mm-card-body">
          <div className="mm-card-meta">
            <span className="mm-card-cat">
              {product.categoryName ?? "Print on Demand"}
              {product.styleCode ? ` · ${product.styleCode}` : ""}
            </span>
            <StarRating />
          </div>

          <h3 className="mm-card-title">
            <Link href={`/product/${product.slug}`}>{product.name}</Link>
          </h3>

          <div className="mm-card-price-row">
            <span className="mm-price-main tnum">{formatUSD(currentPrice)}</span>
            {wasPrice ? <span className="mm-price-del tnum">{formatUSD(wasPrice)}</span> : null}
            <span className="mm-price-unit">/ blank</span>
          </div>

          {/* Color Swatch Dots */}
          {product.colors.length > 1 ? (
            <div className="mm-card-swatches" aria-label="Available colors">
              {product.colors.slice(0, 6).map((c, idx) => (
                <button
                  key={c.slug}
                  type="button"
                  className={`mm-swatch-dot ${selectedColorIdx === idx ? "active" : ""}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  aria-label={`Select ${c.name}`}
                  onClick={() => setSelectedColorIdx(idx)}
                />
              ))}
              {product.colors.length > 6 ? (
                <span style={{ fontSize: "11px", color: "#888", marginLeft: "2px" }}>
                  +{product.colors.length - 6}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* 3. Permanently Visible & Perfectly Aligned Customize Button */}
          <div className="mm-card-action">
            <Link
              href={`/customize/${product.slug}?color=${selectedColor?.slug ?? ""}`}
              className="mm-card-customize-btn"
              aria-label={`Customize ${product.name}`}
            >
              <PaintBrushIcon />
              <span>Customize This Blank</span>
            </Link>
          </div>
        </div>
      </article>

      {/* Quick View Modal */}
      {quickViewOpen ? (
        <QuickViewModal product={product} onClose={() => setQuickViewOpen(false)} />
      ) : null}
    </>
  );
}
