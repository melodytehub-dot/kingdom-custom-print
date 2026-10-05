import Image from "next/image";
import ProductFabric from "./ProductFabric";
import AccessoryProfile from "./AccessoryProfile";
import Garment from "./Garment";
import { photographyFamily, type ProductView } from "@/lib/product-presentation";
import { mockupsForProduct } from "@/lib/mockups";
import type { Product, ProductColor } from "@/lib/types";

export default function ProductPhotography({ product, color, view = "front", className = "", priority = false, decorative = false, isolated = false }: {
  product: Product; color?: ProductColor; view?: ProductView;
  className?: string; priority?: boolean; decorative?: boolean; isolated?: boolean;
}) {
  const family = photographyFamily(product);
  const selected = color ?? product.colors[0];
  const label = `${product.name} in ${selected?.name ?? "White"}, ${view} view`;
  const index = { front: 0, back: 1, side: 2 }[view];
  if (family && isolated) {
    const src = `/api/garment-preview?family=${family}&color=${(selected?.hex ?? "#FFFFFF").replace("#", "")}&view=${view}`;
    return <span className={`product-photography ${className}`} data-photo-color={selected?.slug} data-photo-view={view}><Image unoptimized src={src} alt={decorative ? "" : label} fill sizes="600px" style={{objectFit:"contain"}}/></span>;
  }
  if (!family) {
    if (view === "side") return <span className={`product-photography ${className}`} data-photo-color={selected?.slug} data-photo-view={view}><AccessoryProfile kind={product.kind} color={selected?.hex ?? "#FFFFFF"} title={label}/></span>;
    const mockups = mockupsForProduct(product);
    const mockup = mockups.find(m => m.slug === selected?.slug) ?? mockups[0];
    const src = (view === "back" ? mockup?.back : mockup?.front) ?? product.images[0]?.url;
    return src ? <span className={`product-photography ${className}`} data-photo-color={selected?.slug} data-photo-view={view}><Image unoptimized src={src} alt={decorative ? "" : label} fill sizes="(max-width: 640px) 50vw, 600px" style={{ objectFit: "contain" }} /></span> : null;
  }
  return (
    <span className={`product-photography ${className}`} role={isolated && !decorative ? "img" : undefined} aria-label={isolated && !decorative ? label : undefined} data-photo-family={family} data-photo-view={view} data-photo-color={selected?.slug}>
      {!isolated && <Image src={`/img/catalog-models/${family}.png`} alt={decorative ? "" : label} width={2172} height={724}
        sizes="(max-width: 640px) 150vw, 1800px" loading={priority ? "eager" : "lazy"}
        style={{ position: "absolute", height: "100%", width: "300%", maxWidth: "none", left: `${-index * 100}%`, right: "auto", objectFit: "fill" }} />}
      <ProductFabric family={family} color={selected?.hex ?? "#FFFFFF"} index={index} />
      <span className="product-photo-fallback" aria-hidden="true"><Garment kind={product.kind} color={selected?.hex ?? "#FFFFFF"} back={view === "back"} /></span>
    </span>
  );
}
