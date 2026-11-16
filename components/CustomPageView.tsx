import Image from "next/image";
import Link from "next/link";
import type { CustomPage } from "@/lib/custom-pages";

/**
 * Renders an administrator-built page. Blocks are plain copy, media, links and
 * questions so nothing on a page can run scripts or break the layout.
 */
export default function CustomPageView({ page }: { page: CustomPage }) {
  return (
    <div className="wrap section custom-page">
      <article className="custom-page-body">
        <header className="custom-page-head">
          <h1 className="display">{page.title}</h1>
          {page.description ? <p className="custom-page-lede">{page.description}</p> : null}
        </header>
        {page.blocks.map(block => {
          switch (block.type) {
            case "heading":
              return <h2 key={block.id} className="custom-page-heading">{block.text}</h2>;
            case "paragraph":
              return block.text.trim() ? <p key={block.id} className="custom-page-text">{block.text}</p> : null;
            case "image":
              return block.src ? (
                <figure key={block.id} className="custom-page-media">
                  <Image src={block.src} alt={block.alt} width={1200} height={800} sizes="(max-width: 900px) 92vw, 780px" />
                </figure>
              ) : null;
            case "button":
              return block.text.trim() && block.href ? (
                <p key={block.id} className="custom-page-action">
                  <Link href={block.href} className="btn">{block.text}</Link>
                </p>
              ) : null;
            case "faq":
              return block.items.length ? (
                <div key={block.id} className="kcp-faq-list custom-page-faq">
                  {block.items.map((item, index) => (
                    <details key={index}>
                      <summary>{item.question}<span aria-hidden="true">+</span></summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              ) : null;
            default:
              return null;
          }
        })}
      </article>
    </div>
  );
}
