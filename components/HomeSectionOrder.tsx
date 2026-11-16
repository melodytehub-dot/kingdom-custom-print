import { Children, cloneElement, Fragment, isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { DEFAULT_MESSAGE_STYLE, type HomepageLayout, type HomepageSectionId } from "@/lib/homepage-builder";
import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

type SectionProps = { id: HomepageSectionId; children: ReactNode };

export function HomepageSection({ children }: SectionProps) {
  return <>{children}</>;
}

export function HomeSectionOrder({ layout, children, preview = false, products = [] }: { layout: HomepageLayout; children: ReactNode; preview?: boolean; products?: Product[] }) {
  const sections = new Map<HomepageSectionId, ReactNode>();
  for (const child of Children.toArray(children)) {
    if (isValidElement<SectionProps>(child)) sections.set(child.props.id, child.props.children);
  }
  for (const block of layout.customBlocks ?? []) {
    if (block.type === "products") {
      const chosen = (block.productIds ?? []).map(id => products.find(product => product.id === id)).filter((product): product is Product => Boolean(product));
      if (chosen.length || preview) sections.set(block.id, <section className="kcp-featured kcp-wrap kcp-custom-products" data-home-section={block.id}><div className="kcp-heading"><div><h2>{block.heading}</h2><p>{block.description}</p></div></div><ul className="mm-product-grid">{chosen.map(product => <li key={product.id}><ProductCard product={product} /></li>)}</ul></section>);
      continue;
    }
    if (block.type === "faq") {
      sections.set(block.id, <section className="kcp-custom-faq kcp-wrap" data-home-section={block.id}><h2>{block.heading}</h2><p>{block.description}</p><div className="kcp-faq-list">{block.faqItems?.map((item, index) => <details key={index}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>);
      continue;
    }
    const style = block.style ?? DEFAULT_MESSAGE_STYLE;
    sections.set(block.id, <section className="kcp-custom-message kcp-wrap" data-home-section={block.id} data-tone={style.tone} data-alignment={style.alignment} data-image-position={style.imagePosition}><div className="kcp-custom-message-inner"><div><h2>{block.heading}</h2><p>{block.description}</p>{block.buttonText && block.buttonLink ? <Link className="kcp-button kcp-button-dark" href={block.buttonLink}>{block.buttonText}</Link> : null}</div>{block.image ? <Image className="kcp-custom-message-image" src={block.image} alt={block.imageAlt ?? ""} width={1200} height={900} /> : null}</div></section>);
  }
  return <>{layout.sections.map(id => {
    const section = sections.get(id);
    const hidden = layout.hiddenSections?.includes(id) ?? false;
    if (hidden && !preview) return null;
    return <Fragment key={id}>{preview && hidden && isValidElement<HTMLAttributes<HTMLElement>>(section) ? cloneElement(section, { hidden: true }) : section}</Fragment>;
  })}</>;
}
