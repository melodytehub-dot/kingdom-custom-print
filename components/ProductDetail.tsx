"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ProductPhotography from "./ProductPhotography";
import { brandForProduct } from "@/lib/product-brands";
import ProductColorQuery from "./ProductColorQuery";
import SizeChart from "./SizeChart";
import { PRODUCT_VIEWS, type ProductView } from "@/lib/product-presentation";
import ArrowRight from "@/components/icons/ArrowRight";
import { formatUSD, lowestPrintedUnit, lowestUnitPrice, quoteProduct, resolveBreak } from "@/lib/pricing";
import { sizeSummary } from "@/lib/sizes";
import type { Product, ProductColor } from "@/lib/types";
import { CartStorageError, useCart } from "@/lib/cart-context";

export default function ProductDetail({ product, initialColor = "" }: { product: Product; initialColor?: string }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [cartError, setCartError] = useState("");
  const readyMade = product.saleMode === "ready-made";
  const [availability, setAvailability] = useState<{ color: string; size: string; available: number; counted: boolean }[] | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  useEffect(() => {
    if (!readyMade) return;
    const controller = new AbortController();
    fetch(`/api/products/${product.id}/availability`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Availability unavailable");
        const data = await response.json() as { options: { color: string; size: string; available: number; counted: boolean }[] };
        setAvailability(data.options);
      }).catch(() => { if (!controller.signal.aborted) setAvailabilityError(true); });
    return () => controller.abort();
  }, [product.id, readyMade]);
  const firstColor = product.colors[0];

  const [colorSlug, setColorSlug] = useState(product.colors.find(c => c.slug === initialColor)?.slug ?? firstColor?.slug ?? "");
  const [view, setView] = useState<ProductView>("front");
  const [photoIndex, setPhotoIndex] = useState(0);
  const colorSlugs = useMemo(() => product.colors.map(c => c.slug), [product.colors]);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [lines, setLines] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const s of product.sizes) seed[s.label] = 0;
    if (!readyMade && product.sizes[1]) seed[product.sizes[1].label] = 1;
    else if (!readyMade && product.sizes[0]) seed[product.sizes[0].label] = 1;
    return seed;
  });

  const color = useMemo(
    () => product.colors.find((c) => c.slug === colorSlug) ?? firstColor,
    [colorSlug, product.colors, firstColor]
  );

  function pickColor(c: ProductColor) {
    setColorSlug(c.slug);
    setPhotoIndex(0);
    if (readyMade && !c.backImage) setView("front");
  }

  const sizeLines = useMemo(
    () => product.sizes.map((s) => ({ label: s.label, qty: lines[s.label] ?? 0 })),
    [product.sizes, lines]
  );

  const totalQty = sizeLines.reduce((n, l) => n + l.qty, 0);

  // Default configuration is a single front print; the back is an add-on.
  const quote = quoteProduct(product, { sides: readyMade ? [] : ["front"], lines: sizeLines });
  const productViews = readyMade ? PRODUCT_VIEWS.filter((angle) => angle === "front" || (angle === "back" && !!color?.backImage)) : product.kind === "polo" ? PRODUCT_VIEWS.filter((angle) => angle !== "side") : PRODUCT_VIEWS;
  const photos = color?.photos?.length ? color.photos : [color?.frontImage, color?.backImage].filter((url): url is string => Boolean(url));
  const tier = resolveBreak(product.priceBreaks, totalQty);

  const floor = readyMade ? lowestUnitPrice(product) : lowestPrintedUnit(product);
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
            sides: readyMade ? [] : ["front"],
            lines: [{ label: "__tier__", qty: b.minQty }],
          }).unitBase,
        })),
    [product, readyMade]
  );

  const availableFor = (label: string) => availability?.find(option => option.color === color?.slug && option.size === label)?.available ?? 0;
  const countedFor = (label: string) => availability?.find(option => option.color === color?.slug && option.size === label)?.counted ?? false;
  const canCustomize = totalQty > 0 && (!readyMade || Boolean(availability && sizeLines.every(line => line.qty <= availableFor(line.label))));

  function setQty(label: string, value: number) {
    const next = Math.max(0, Math.min(readyMade ? Math.min(999, availableFor(label)) : 999, Math.floor(Number(value) || 0)));
    setLines((prev) => ({ ...prev, [label]: next }));
  }

  function addReadyMade() {
    if (!color || !totalQty) return;
    try {
      addItem({ productId: product.id, productSlug: product.slug, productName: product.name, productKind: product.kind, saleMode: "ready-made", colorSlug: color.slug, colorName: color.name, colorHex: color.hex, sidesUsed: [], design: { front: [], back: [] }, previewFront: color.frontImage ?? null, previewBack: color.backImage ?? null, lines: sizeLines.filter(line => line.qty > 0), surcharges: Object.fromEntries(product.sizes.map(size => [size.label, size.surcharge])), unitPrice: quote.unitBase, total: quote.total, quantity: totalQty });
      router.push("/cart");
    } catch (error) {
      if (!(error instanceof CartStorageError)) throw error;
      setCartError("Your cart could not be saved. Please allow browser storage and try again.");
    }
  }

  return (
    <div className="pdp">
      <Suspense fallback={null}><ProductColorQuery allowed={colorSlugs} onColor={setColorSlug} /></Suspense>
      <div className="pdp-media">
        <div className="pdp-photo-stage">
          {readyMade && photos.length ? <span className="product-photography"><Image unoptimized src={photos[photoIndex] ?? photos[0]} alt={`${product.name}, ${color?.name ?? ""}, photo ${photoIndex + 1}`} fill sizes="(max-width: 640px) 100vw, 600px" style={{objectFit:"contain"}} /></span> : <ProductPhotography key={`${color?.slug}:${view}`} product={product} color={color} view={view} priority />}
          <button type="button" className="pdp-gallery-arrow pdp-gallery-prev" aria-label="Previous product view"
            onClick={() => readyMade ? setPhotoIndex((photoIndex + photos.length - 1) % photos.length) : setView(productViews[(productViews.indexOf(view) + productViews.length - 1) % productViews.length])}>‹</button>
          <button type="button" className="pdp-gallery-arrow pdp-gallery-next" aria-label="Next product view"
            onClick={() => readyMade ? setPhotoIndex((photoIndex + 1) % photos.length) : setView(productViews[(productViews.indexOf(view) + 1) % productViews.length])}>›</button>
        </div>
        <p className="pdp-view-caption" aria-live="polite">{color?.name} · {readyMade ? `Photo ${photoIndex + 1} of ${photos.length}` : `${view} view`}</p>
        <ul className="pdp-thumbs" aria-label="Product views">
          {readyMade ? photos.map((src, index) => <li key={src}><button type="button" className={`pdp-thumb${index === photoIndex ? " is-active" : ""}`} onClick={() => setPhotoIndex(index)} aria-label={`View photo ${index + 1}`} aria-pressed={index === photoIndex}><span className="product-photography"><Image unoptimized src={src} alt="" fill sizes="80px" style={{objectFit:"contain"}} /></span><span>{index + 1}</span></button></li>) : productViews.map(angle => (
            <li key={angle}>
              <button type="button" className={`pdp-thumb${angle === view ? " is-active" : ""}`}
                onClick={() => setView(angle)} aria-label={`View ${angle}`} aria-pressed={angle === view}>
                <ProductPhotography key={`${color?.slug}:${angle}`} product={product} color={color} view={angle} decorative priority={angle === "front"} />
                <span>{angle}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pdp-panel">
        <p className="eyebrow">
          {brandForProduct(product)?.name ?? product.categoryName ?? (readyMade ? "Shop" : "Blank")}
          {product.styleCode ? ` · Style ${product.styleCode}` : ""}
        </p>
        <h1 className="h2 pdp-title wrap-anywhere">{product.name}</h1>
        <p className="lede pdp-blurb">{product.blurb}</p>

        <div className="pdp-price-row">
          <p className="pdp-price tnum">
            <strong>{formatUSD(quote.unitBase)}</strong> each{readyMade ? "" : ", one side"}
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
            {readyMade ? "Choose options and quantity" : "Size run"}
            <span className="opt-hint">
              {totalQty > 0
                ? `${totalQty} ${readyMade ? "item" : "garment"}${totalQty === 1 ? "" : "s"}`
                : "Set a quantity per size"}
            </span>
          </legend>

          {!readyMade && product.kind !== "other" ? <button
            type="button"
            className="link"
            onClick={() => setShowSizeChart(true)}
            style={{ marginBottom: "12px", fontSize: "11px" }}
          >
            View size chart
          </button> : null}

          <div className="size-run">
            {product.sizes.map((s) => (
              <div
                key={s.label}
                className={`size-cell${(lines[s.label] ?? 0) > 0 ? " has-qty" : ""}`}
              >
                <label htmlFor={`qty-${s.label}`} className="size-label">
                  {s.label}
                  {readyMade && availability && availableFor(s.label) === 0 ? <span className="size-add">{countedFor(s.label) ? "Sold out" : "Not yet available"}</span> : null}
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
                    disabled={readyMade && (!availability || availableFor(s.label) === 0)}
                    value={lines[s.label] ?? 0}
                    onChange={(e) => setQty(s.label, Number(e.target.value))}
                    aria-label={`${s.label} quantity`}
                  />
                  <button
                    type="button"
                    onClick={() => setQty(s.label, (lines[s.label] ?? 0) + 1)}
                    disabled={readyMade && (!availability || (lines[s.label] ?? 0) >= availableFor(s.label))}
                    aria-label={`Increase ${s.label} quantity`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="quick-sizes">
            <span className="small muted">Quick add:</span>
            {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((label) => {
              const exists = product.sizes.some((s) => s.label === label);
              if (!exists) return null;
              const currentQty = lines[label] || 0;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={readyMade && (!availability || currentQty >= availableFor(label))}
                  className="quick-btn"
                  onClick={() => {
                    setQty(label, currentQty + 1);
                  }}
                  title={`Add one ${label}`}
                >
                  +{label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Quote summary */}
        <div className="pdp-quote" aria-live="polite">
          <div className="quote-row">
            <span>{readyMade ? "Item price" : "Front print"}</span>
            <span className="tnum">{formatUSD(quote.unitBase)} each</span>
          </div>

          {!readyMade && secondSide > 0 ? (
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
          {readyMade && !availability && !availabilityError ? <p role="status">Checking availability…</p> : null}
          {readyMade && availabilityError ? <p role="alert">Availability is temporarily unavailable. Please refresh the page or contact us.</p> : null}
          {readyMade && availability && totalQty > 0 && !canCustomize ? <p role="alert">Please adjust your quantities for the selected color.</p> : null}
          {cartError ? <p role="alert">{cartError}</p> : null}
          <button
            type="button"
            className="btn btn-lg"
            disabled={!canCustomize}
            onClick={() => readyMade ? addReadyMade() :
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
            {readyMade ? "Add to cart" : "Customize this"}
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
          {!readyMade ? <li>
            <span className="spec-k">Printable sides</span>
            <span>Front and back</span>
          </li> : null}
          <li>
            <span className="spec-k">Sizes</span>
            <span className="wrap-anywhere">{product.kind === "other" ? product.sizes.map(size => size.label).join(", ") : sizeSummary(product.sizes)}</span>
          </li>
          {!readyMade ? <li>
            <span className="spec-k">Decoration</span>
            <span>Screen print and DTF available on request</span>
          </li> : null}
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
            {!readyMade ? <p className="hint">One printed side. Free US shipping over $75.</p> : null}
          </div>
        ) : null}
      </div>

      {showSizeChart && (
        <SizeChart
          productKind={product.kind}
          productName={product.name}
          onClose={() => setShowSizeChart(false)}
        />
      )}
    </div>
  );
}
