type SkeletonVariant = "home" | "shop" | "product" | "studio" | "cart" | "checkout" | "account" | "admin" | "page";

function Lines({ count = 3 }: { count?: number }) {
  return <div className="sk-lines">{Array.from({ length: count }, (_, index) => <span className="sk-block sk-line" key={index} />)}</div>;
}
function Cards({ count = 4 }: { count?: number }) {
  return <div className="sk-cards">{Array.from({ length: count }, (_, index) => <div className="sk-card" key={index}><span className="sk-block sk-card-image" /><Lines count={2} /></div>)}</div>;
}

/** The shapes are decorative; one status message announces the actual wait. */
export default function PageSkeleton({ variant = "page" }: { variant?: SkeletonVariant }) {
  return <div className={`sk-page sk-${variant}`} role="status" aria-live="polite" aria-label="Loading page">
    <span className="sr-only">Loading page</span>
    <div className="sk-layout" aria-hidden="true">
      {variant === "home" ? <><div className="sk-home-hero"><span className="sk-block sk-kicker" /><span className="sk-block sk-title" /><Lines count={2} /><span className="sk-block sk-button" /></div><div className="sk-section"><span className="sk-block sk-heading" /><Cards /></div></> : null}
      {variant === "shop" ? <><span className="sk-block sk-kicker" /><span className="sk-block sk-title" /><Lines count={1} /><div className="sk-pills"><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /></div><Cards count={8} /></> : null}
      {variant === "product" ? <div className="sk-columns"><span className="sk-block sk-product-image" /><div className="sk-details"><span className="sk-block sk-kicker" /><span className="sk-block sk-title" /><Lines /><div className="sk-pills"><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /></div><span className="sk-block sk-button" /></div></div> : null}
      {variant === "studio" ? <><div className="sk-studio-header"><span className="sk-block sk-logo" /><span className="sk-block sk-button" /></div><div className="sk-studio-body"><div className="sk-studio-tools"><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /></div><div className="sk-studio-stage"><span className="sk-block sk-garment" /></div></div></> : null}
      {variant === "cart" || variant === "checkout" ? <><span className="sk-block sk-title" /><div className="sk-columns sk-order-columns"><div><div className="sk-order-item"><span className="sk-block sk-order-image" /><Lines /></div><div className="sk-order-item"><span className="sk-block sk-order-image" /><Lines /></div></div><div className="sk-summary"><span className="sk-block sk-heading" /><Lines /><span className="sk-block sk-button" /></div></div></> : null}
      {variant === "admin" ? <><span className="sk-block sk-title" /><div className="sk-admin-nav"><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /></div><div className="sk-admin-stats"><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /><span className="sk-block" /></div><span className="sk-block sk-heading" /><Lines count={4} /></> : null}
      {variant === "account" || variant === "page" ? <><span className="sk-block sk-kicker" /><span className="sk-block sk-title" /><div className="sk-content"><Lines count={4} /><span className="sk-block sk-button" /></div></> : null}
    </div>
  </div>;
}

export function InlineSkeleton({ label, rows = 3, grid = false }: { label: string; rows?: number; grid?: boolean }) {
  return <div className="sk-inline" role="status" aria-live="polite" aria-label={label}><span className="sr-only">{label}</span><div aria-hidden="true">{grid ? <div className="sk-inline-grid">{Array.from({ length: 6 }, (_, index) => <span className="sk-block" key={index} />)}</div> : <Lines count={rows} />}</div></div>;
}
