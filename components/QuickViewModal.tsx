"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import Garment from "./Garment";
import ArrowRight from "./icons/ArrowRight";
import { formatUSD, lowestPrintedUnit } from "@/lib/pricing";
import { hasDedicatedMockupFamily, mockupsForProduct } from "@/lib/mockups";
import type { Product } from "@/lib/types";

export default function QuickViewModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSelectedColorIdx(0);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [product, onClose]);

  if (!mounted || !product) return null;

  const selectedColor = product.colors[selectedColorIdx] ?? product.colors[0];
  const baseHex = selectedColor?.hex ?? product.colors[0]?.hex ?? "#141414";
  const allMockups = hasDedicatedMockupFamily(product) ? mockupsForProduct(product) : [];
  const currentMockup = allMockups.find((m) => m.slug === selectedColor?.slug) ?? allMockups[0];

  const frontImgUrl = currentMockup?.front ?? product.images[0]?.url;
  const backImgUrl = currentMockup?.back ?? product.images[1]?.url;

  const wasPrice = product.compareAt;
  const fromUnit = lowestPrintedUnit(product);
  const currentPrice = fromUnit !== null ? fromUnit : product.basePrice;

  return createPortal(
    <div className="mm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="mm-modal-container" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="mm-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="mm-quickview-layout">
          {/* Media Column */}
          <div className="mm-quickview-media">
            <div className="mm-quickview-image-wrap">
              {frontImgUrl ? (
                <Image
                  src={frontImgUrl}
                  alt={product.name}
                  fill
                  sizes="400px"
                  className="mm-quickview-img"
                  priority
                />
              ) : (
                <Garment kind={product.kind} color={baseHex} className="mm-quickview-img" />
              )}
            </div>

            {backImgUrl && backImgUrl !== frontImgUrl ? (
              <p className="mm-quickview-side-note">Front & Back printable sides available</p>
            ) : null}
          </div>

          {/* Details Column */}
          <div className="mm-quickview-info">
            <span className="mm-card-cat">
              {product.categoryName ?? "Print on Demand"}
              {product.styleCode ? ` · ${product.styleCode}` : ""}
            </span>

            <h2 className="mm-quickview-title">{product.name}</h2>

            <div className="mm-quickview-price-row">
              <span className="mm-quickview-price tnum">{formatUSD(currentPrice)}</span>
              {wasPrice ? <span className="mm-price-del tnum">{formatUSD(wasPrice)}</span> : null}
              <span className="mm-price-unit">per printed garment</span>
            </div>

            <p className="mm-quickview-blurb">{product.blurb}</p>

            {/* Color Swatches */}
            <div className="mm-quickview-section">
              <span className="mm-quickview-label">
                Color: <strong>{selectedColor?.name}</strong>
              </span>
              <div className="mm-quickview-swatches">
                {product.colors.map((c, idx) => (
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
              </div>
            </div>

            {/* Sizes Available */}
            {product.sizes.length ? (
              <div className="mm-quickview-section">
                <span className="mm-quickview-label">Available Sizes:</span>
                <div className="mm-quickview-sizes">
                  {product.sizes.map((s) => (
                    <span key={s.label} className="mm-size-pill">
                      {s.label}
                      {s.surcharge > 0 ? ` (+${formatUSD(s.surcharge)})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Actions */}
            <div className="mm-quickview-actions">
              <Link
                href={`/customize/${product.slug}?color=${selectedColor?.slug ?? ""}`}
                className="btn btn-lg btn-red"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={onClose}
              >
                Customize This Blank
                <ArrowRight />
              </Link>

              <Link
                href={`/product/${product.slug}`}
                className="btn btn-lg btn-ghost"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={onClose}
              >
                View Full Garment Specs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
