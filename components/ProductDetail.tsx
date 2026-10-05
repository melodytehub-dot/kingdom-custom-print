"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProductPhotography from "./ProductPhotography";
import ProductColorQuery from "./ProductColorQuery";
import { PRODUCT_VIEWS, type ProductView } from "@/lib/product-presentation";
import ArrowRight from "@/components/icons/ArrowRight";
import { formatUSD, lowestPrintedUnit, quoteProduct, resolveBreak } from "@/lib/pricing";
import { sizeSummary } from "@/lib/sizes";
import type { Product, ProductColor } from "@/lib/types";

export default function ProductDetail({ product, initialColor = "" }: { product: Product; initialColor?: string }) {
  const router = useRouter();
  const firstColor = product.colors[0];

  const [colorSlug, setColorSlug] = useState(product.colors.find(c => c.slug === initialColor)?.slug ?? firstColor?.slug ?? "");
  const [view, setView] = useState<ProductView>("front");
  const colorSlugs = useMemo(() => product.colors.map(c => c.slug), [product.colors]);
  const [lines, setLines] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const s of product.sizes) seed[s.label] = 0;
    if (product.sizes[1]) seed[product.sizes[1].label] = 1;
    else if (product.sizes[0]) seed[product.sizes[0].label] = 1;
    return seed;
  });

  const color = useMemo(
    () => product.colors.find((c) => c.slug === colorSlug) ?? firstColor,
    [colorSlug, product.colors, firstColor]
  );

  function pickColor(c: ProductColor) {
    setColorSlug(c.slug);
  }

  const sizeLines = useMemo(
    () => product.sizes.map((s) => ({ label: s.label, qty: lines[s.label] ?? 0 })),
    [product.sizes, lines]
  );

  const totalQty = sizeLines.reduce((n, l) => n + l.qty, 0);

  // Default configuration is a single front print; the back is an add-on.
  const quote = quoteProduct(product, { sides: ["front"], lines: sizeLines });
  const tier = resolveBreak(product.priceBreaks, totalQty);

  const floor = lowestPrintedUnit(product);
  const surcharge = quote.surchargeTotal;
  const perUnit = quote.unitBase;
  const secondSide = product.printFeePerSide;

  // Published quantity tiers, priced for a single printed side.
  const tiers = useMemo(
    () =>
      product.priceBreaks
        .slice()
        .sort((a, b) => a.minQty - b.minQty)
        .map((b) => ({
          minQty: b.minQty,
          unit: quoteProduct(product, {
            sides: ["front"],
            lines: [{ label: "__tier__", qty: b.minQty }],
          }).unitBase,
        })),
    [product]
  );

  const canCustomize = totalQty > 0;

  function setQty(label: string, value: number) {
    const next = Math.max(0, Math.min(999, Math.floor(Number(value) || 0)));
    setLines((prev) => ({ ...prev, [label]: next }));
  }

  return (
    <div className="pdp">
      <Suspense fallback={null}><ProductColorQuery allowed={colorSlugs} onColor={setColorSlug} /></Suspense>
      <div className="pdp-media">
        <div className="pdp-photo-stage">
          <ProductPhotography product={product} color={color} view={view} priority />
          <button type="button" className="pdp-gallery-arrow pdp-gallery-prev" aria-label="Previous product view"
            onClick={() => setView(PRODUCT_VIEWS[(PRODUCT_VIEWS.indexOf(view) + 2) % 3])}>‹</button>
          <button type="button" className="pdp-gallery-arrow pdp-gallery-next" aria-label="Next product view"
            onClick={() => setView(PRODUCT_VIEWS[(PRODUCT_VIEWS.indexOf(view) + 1) % 3])}>›</button>
        </div>
        <p className="pdp-view-caption" aria-live="polite">{color?.name} · {view} view</p>
        <ul className="pdp-thumbs" aria-label="Product views">
          {PRODUCT_VIEWS.map(angle => (
            <li key={angle}>
              <button type="button" className={`pdp-thumb${angle === view ? " is-active" : ""}`}
                onClick={() => setView(angle)} aria-label={`View ${angle}`} aria-pressed={angle === view}>
                <ProductPhotography product={product} color={color} view={angle} decorative />
                <span>{angle}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pdp-panel">
        <p className="eyebrow">
          {product.categoryName ?? "Blank"}
          {product.styleCode ? ` · Style ${product.styleCode}` : ""}
        </p>
        <h1 className="h2 pdp-title wrap-anywhere">{product.name}</h1>
        <p className="lede pdp-blurb">{product.blurb}</p>

        <div className="pdp-price-row">
          <p className="pdp-price tnum">
            <strong>{formatUSD(quote.unitBase)}</strong> each, one side
          </p>
          {floor !== null && floor < quote.unitBase ? (
            <p className="small muted">
              From {formatUSD(floor)} each at {tiers[tiers.length - 1]?.minQty}+
            </p>
          ) : null}
        </div>

        {/* Color */}
        <fieldset className="opt-group">
          <legend className="label">
            Color: <span className="opt-value">{color?.name}</span>
          </legend>
          <ul className="swatches">
            {product.colors.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  className={`swatch${c.slug === color?.slug ? " is-active" : ""}`}
                  style={{ background: c.hex }}
                  onClick={() => pickColor(c)}
                  aria-pressed={c.slug === color?.slug}
                  title={c.name}
                >
                  <span className="sr-only">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        {/* Size run */}
        <fieldset className="opt-group">
          <legend className="label">
            Size run
            <span className="opt-hint">
              {totalQty > 0
                ? `${totalQty} garment${totalQty === 1 ? "" : "s"}`
                : "Set a quantity per size"}
            </span>
          </legend>

          <div className="size-run">
            {product.sizes.map((s) => (
              <div
                key={s.label}
                className={`size-cell${(lines[s.label] ?? 0) > 0 ? " has-qty" : ""}`}
              >
                <label htmlFor={`qty-${s.label}`} className="size-label">
                  {s.label}
                  {s.surcharge > 0 ? (
                    <span className="size-add">+{formatUSD(s.surcharge)}</span>
                  ) : null}
                </label>
                <div className="size-stepper">
                  <button
                    type="button"
                    onClick={() => setQty(s.label, (lines[s.label] ?? 0) - 1)}
                    disabled={(lines[s.label] ?? 0) <= 0}
                    aria-label={`Decrease ${s.label} quantity`}
                  >
                    &minus;
                  </button>
                  <input
                    id={`qty-${s.label}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    value={lines[s.label] ?? 0}
                    onChange={(e) => setQty(s.label, Number(e.target.value))}
                    aria-label={`${s.label} quantity`}
                  />
                  <button
                    type="button"
                    onClick={() => setQty(s.label, (lines[s.label] ?? 0) + 1)}
                    aria-label={`Increase ${s.label} quantity`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="quick-sizes">
            <span className="small muted">Quick fill:</span>
            {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((label) => {
              const exists = product.sizes.some((s) => s.label === label);
              if (!exists) return null;
              return (
                <button
                  key={label}
                  type="button"
                  className="quick-btn"
                  onClick={() => {
                    const next: Record<string, number> = {};
                    for (const s of product.sizes) next[s.label] = s.label === label ? totalQty || 1 : 0;
                    setLines(next);
                  }}
                >
                  All {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Quote summary */}
        <div className="pdp-quote" aria-live="polite">
          <div className="quote-row">
            <span>Front print</span>
            <span className="tnum">{formatUSD(quote.unitBase)} each</span>
          </div>

          {secondSide > 0 ? (
            <div className="quote-row">
              <span>Add a back print</span>
              <span className="tnum muted">+{formatUSD(secondSide)} each</span>
            </div>
          ) : null}

          {tier ? (
            <div className="quote-row quote-tier">
              <span>Quantity break at {tier.minQty}+</span>
              <span className="tnum">{formatUSD(tier.amountOff)}</span>
            </div>
          ) : null}

          <div className="quote-row quote-total">
            <span>
              {totalQty > 0 ? `${totalQty} × ${formatUSD(perUnit)}` : "Estimated total"}
            </span>
            <strong className="tnum">
              {totalQty > 0 ? formatUSD(quote.total) : "—"}
            </strong>
          </div>

          {surcharge > 0 ? (
            <p className="hint">Includes {formatUSD(surcharge)} in extended size charges.</p>
          ) : null}
        </div>

        <div className="pdp-actions">
          <button
            type="button"
            className="btn btn-lg"
            disabled={!canCustomize}
            onClick={() =>
              router.push(
                `/customize/${product.slug}?color=${color?.slug ?? ""}&sizes=${encodeURIComponent(
                  Object.entries(lines)
                    .filter(([, q]) => q > 0)
                    .map(([l, q]) => `${l}:${q}`)
                    .join(",")
                )}`
              )
            }
          >
            Customize this
            <ArrowRight />
          </button>
          <Link href="/contact" className="btn btn-lg btn-ghost">
            Ask a question
          </Link>
        </div>

        <ul className="pdp-specs">
          {product.styleCode ? (
            <li>
              <span className="spec-k">Style</span>
              <span>{product.styleCode}</span>
            </li>
          ) : null}
          {product.material ? (
            <li>
              <span className="spec-k">Material</span>
              <span>{product.material}</span>
            </li>
          ) : null}
          <li>
            <span className="spec-k">Printable sides</span>
            <span>Front and back</span>
          </li>
          <li>
            <span className="spec-k">Sizes</span>
            <span className="wrap-anywhere">{sizeSummary(product.sizes)}</span>
          </li>
          <li>
            <span className="spec-k">Decoration</span>
            <span>Screen print and DTF available on request</span>
          </li>
        </ul>

        {tiers.length > 1 ? (
          <div className="pdp-breaks">
            <p className="label">Price by quantity</p>
            <table className="breaks-table">
              <thead>
                <tr>
                  <th scope="col">Quantity</th>
                  <th scope="col">Price each</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => {
                  const next = tiers[i + 1];
                  const label = next ? `${t.minQty}–${next.minQty - 1}` : `${t.minQty}+`;
                  const isActive =
                    totalQty >= t.minQty && (!next || totalQty < next.minQty);
                  return (
                    <tr key={t.minQty} className={isActive ? "is-active" : undefined}>
                      <td className="tnum">{label}</td>
                      <td className="tnum">{formatUSD(t.unit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint">One printed side. Free US shipping over $75.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
