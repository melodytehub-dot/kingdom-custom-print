"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Garment from "@/components/Garment";
import ArrowRight from "@/components/icons/ArrowRight";
import { formatUSD, lowestUnitPrice, quoteProduct, resolveBreak } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export default function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const firstColor = product.colors[0];

  const [colorSlug, setColorSlug] = useState(firstColor?.slug ?? "");
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

  const sizeLines = useMemo(
    () => product.sizes.map((s) => ({ label: s.label, qty: lines[s.label] ?? 0 })),
    [product.sizes, lines]
  );

  const totalQty = sizeLines.reduce((n, l) => n + l.qty, 0);

  // Quote both sides so the price shown covers a front-and-back print.
  const quoteBoth = quoteProduct(product, { sides: ["front", "back"], lines: sizeLines });
  const quoteOne = quoteProduct(product, { sides: ["front"], lines: sizeLines });
  const tier = resolveBreak(product.priceBreaks, totalQty);

  const floor = lowestUnitPrice(product);
  const surcharge = quoteBoth.surchargeTotal;
  // Both-side quote is what the customer actually pays per garment; the
  // surcharge is added on top for extended sizes.
  const perUnit = quoteBoth.unitBase;

  const canCustomize = totalQty > 0;

  function setQty(label: string, value: number) {
    const next = Math.max(0, Math.min(999, Math.floor(Number(value) || 0)));
    setLines((prev) => ({ ...prev, [label]: next }));
  }

  return (
    <div className="pdp">
      <div className="pdp-media">
        {product.images.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0].url} alt={product.images[0].alt || product.name} />
        ) : (
          <Garment
            kind={product.kind}
            color={color?.hex ?? "#141414"}
            title={`${product.name} in ${color?.name ?? "black"}`}
          />
        )}

        {product.compareAt ? (
          <p className="pdp-save">
            Save {formatUSD(product.compareAt - product.basePrice)} per garment
          </p>
        ) : null}
      </div>

      <div className="pdp-panel">
        <p className="eyebrow">{product.categoryName ?? "Blank"}</p>
        <h1 className="h2 pdp-title wrap-anywhere">{product.name}</h1>
        <p className="lede pdp-blurb">{product.blurb}</p>

        <div className="pdp-price-row">
          <p className="pdp-price tnum">
            <strong>{formatUSD(quoteBoth.unitBase)}</strong> per garment
          </p>
          {floor !== null && floor < quoteBoth.unitBase ? (
            <p className="small muted">
              Drops to {formatUSD(floor)} per garment at bulk quantities
            </p>
          ) : null}
        </div>

        {/* Colour */}
        <fieldset className="opt-group">
          <legend className="label">
            Colour:{" "}
            <span className="opt-value">{color?.name}</span>
          </legend>
          <ul className="swatches">
            {product.colors.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  className={`swatch${c.slug === color?.slug ? " is-active" : ""}`}
                  style={{ background: c.hex }}
                  onClick={() => setColorSlug(c.slug)}
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
            <span>
              {product.printFeePerSide > 0
                ? `Blank ${formatUSD(product.basePrice)} + print from ${formatUSD(product.printFeePerSide)}/side`
                : "Blank price"}
            </span>
            {quoteOne.printCharge > 0 ? (
              <span className="tnum muted">
                +{formatUSD(quoteOne.printCharge)} for 2 sides
              </span>
            ) : null}
          </div>

          {tier ? (
            <div className="quote-row quote-tier">
              <span>
                Quantity break at {tier.minQty}+
                {tier.amountOff < 0 ? " per garment" : ""}
              </span>
              <span className="tnum">
                {tier.amountOff < 0 ? formatUSD(tier.amountOff) : formatUSD(tier.amountOff)}
              </span>
            </div>
          ) : null}

          <div className="quote-row quote-total">
            <span>
              {totalQty > 0 ? `${totalQty} × ${formatUSD(perUnit)}` : "Estimated total"}
            </span>
            <strong className="tnum">
              {totalQty > 0 ? formatUSD(quoteBoth.total) : "—"}
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
            Customise this
            <ArrowRight />
          </button>
          <Link href="/contact" className="btn btn-lg btn-ghost">
            Ask a question
          </Link>
        </div>

        <ul className="pdp-specs">
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
            <span className="wrap-anywhere">{product.sizes.map((s) => s.label).join(", ")}</span>
          </li>
          <li>
            <span className="spec-k">Decoration</span>
            <span>Screen print and DTF available on request</span>
          </li>
        </ul>
      </div>
    </div>
  );
}