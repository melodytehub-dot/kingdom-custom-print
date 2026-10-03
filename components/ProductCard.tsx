import Link from "next/link";
import Image from "next/image";
import Garment from "./Garment";
import { formatUSD, largestBreakQty, lowestPrintedUnit } from "@/lib/pricing";
import { hasDedicatedMockupFamily, mockupsForProduct } from "@/lib/mockups";
import type { Product } from "@/lib/types";

function ColorDots({ colors }: { colors: Product["colors"] }) {
  const shown = colors.slice(0, 4);
  const rest = colors.length - shown.length;

  return (
    <span className="dots" aria-hidden="true">
      {shown.map((c) => (
        <span key={c.slug} className="dot" style={{ background: c.hex }} />
      ))}
      {rest > 0 ? <span className="dot-more">+{rest}</span> : null}
    </span>
  );
}

function sizeRange(product: Product): string | null {
  if (product.sizes.length < 2) return null;
  return `${product.sizes[0].label} – ${product.sizes[product.sizes.length - 1].label}`;
}

export default function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const base = product.colors[0]?.hex ?? "#141414";
  const wasPrice = product.compareAt;
  const fromUnit = lowestPrintedUnit(product);
  const tier = largestBreakQty(product);
  const generated = hasDedicatedMockupFamily(product) ? mockupsForProduct(product)[0] : null;
  const image = generated
    ? { url: generated.front, alt: `${product.name} in ${generated.name}` }
    : product.images[0];
  const range = sizeRange(product);

  return (
    <article className="pcard">
      <Link href={`/product/${product.slug}`} className="pcard-media" tabIndex={-1} aria-hidden="true">
        {image ? (
          <Image
            src={image.url}
            alt=""
            fill
            sizes="(max-width: 560px) 50vw, (max-width: 1000px) 33vw, 300px"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className="pcard-img"
          />
        ) : (
          <Garment kind={product.kind} color={base} className="pcard-garment" />
        )}

        {wasPrice ? <span className="badge badge-sale pcard-flag">Sale</span> : null}
      </Link>

      <div className="pcard-body">
        <p className="pcard-cat">
          {product.categoryName ?? "Blank"}
          {product.styleCode ? <span className="pcard-style"> · {product.styleCode}</span> : null}
        </p>

        <h3 className="pcard-title wrap-anywhere">
          <Link href={`/product/${product.slug}`}>{product.name}</Link>
        </h3>

        <p className="pcard-price tnum">
          {fromUnit !== null ? (
            <>
              <span>from {formatUSD(fromUnit)}</span>
              <span className="pcard-from">each{tier ? ` at ${tier}+` : ""}</span>
            </>
          ) : (
            <span>{formatUSD(product.basePrice)}</span>
          )}
        </p>

        <p className="pcard-meta">
          <ColorDots colors={product.colors} />
          <span className="muted">
            {product.colors.length} color{product.colors.length === 1 ? "" : "s"}
          </span>
          {range ? <span className="pcard-size muted">{range}</span> : null}
        </p>

        <div className="pcard-actions">
          <Link href={`/customize/${product.slug}`} className="btn btn-red btn-sm">
            Customize
          </Link>
          <Link href={`/product/${product.slug}`} className="btn btn-light btn-sm">
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
