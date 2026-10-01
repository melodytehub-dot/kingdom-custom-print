import Link from "next/link";
import Garment from "./Garment";
import { formatUSD, lowestUnitPrice } from "@/lib/pricing";
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

export default function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const base = product.colors[0]?.hex ?? "#141414";
  const wasPrice = product.compareAt;
  const floor = lowestUnitPrice(product);

  return (
    <article className="pcard">
      <Link
        href={`/product/${product.slug}`}
        className="pcard-media"
        tabIndex={-1}
        aria-hidden="true"
      >
        {product.images.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0].url} alt="" loading={priority ? "eager" : "lazy"} />
        ) : (
          <Garment kind={product.kind} color={base} />
        )}

        {wasPrice ? <span className="badge badge-sale pcard-flag">Sale</span> : null}
        {!wasPrice && product.compareAt === null && product.featured ? (
          <span className="badge pcard-flag">Popular</span>
        ) : null}
      </Link>

      <div className="pcard-body">
        <div className="pcard-top">
          <h3 className="pcard-title wrap-anywhere">
            <Link href={`/product/${product.slug}`}>{product.name}</Link>
          </h3>
          <p className="pcard-price tnum">
            {wasPrice ? (
              <>
                <s>{formatUSD(wasPrice)}</s>
                <span>{formatUSD(product.basePrice)}</span>
              </>
            ) : (
              <span>{formatUSD(product.basePrice)}</span>
            )}
          </p>
        </div>

        <p className="pcard-meta">
          <ColorDots colors={product.colors} />
          <span className="muted">
            {product.colors.length} color{product.colors.length === 1 ? "" : "s"}
          </span>
        </p>

        <div className="pcard-actions">
          <Link href={`/product/${product.slug}`} className="btn btn-light btn-sm">
            Details
          </Link>
          <Link href={`/customize/${product.slug}`} className="btn btn-sm">
            Customize
            {floor !== null ? (
              <span className="btn-sub tnum">{formatUSD(floor)}+</span>
            ) : null}
          </Link>
        </div>
      </div>
    </article>
  );
}