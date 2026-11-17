import Image from "next/image";
import Link from "next/link";
import type { BuilderPage, ColumnNode, SectionNode, WidgetNode } from "@/lib/builder/schema";
import { builderStylesheet } from "@/lib/builder/styles";

/**
 * Renders a builder page.
 *
 * The same component draws the published page and the editor canvas, so what an
 * owner sees while editing is what visitors get. `editing` only adds empty-state
 * hints; it never changes the layout or the data.
 */

type PageShape = Pick<BuilderPage, "title" | "description" | "showTitle" | "layout">;

function ImageWidget({ node, editing }: { node: Extract<WidgetNode, { kind: "image" }>; editing: boolean }) {
  const ratio = node.style.desktop.aspectRatio;
  if (!node.src) {
    return editing ? (
      <span className="kcp-b-empty">Choose a photo in the panel on the right.</span>
    ) : null;
  }

  const image = ratio ? (
    <span className="kcp-b-image-frame">
      <Image
        src={node.src}
        alt={node.alt}
        fill
        sizes="(max-width: 768px) 100vw, 1200px"
        style={{ objectFit: node.style.desktop.objectFit ?? "cover" }}
      />
    </span>
  ) : (
    <Image
      src={node.src}
      alt={node.alt}
      width={1600}
      height={1000}
      sizes="(max-width: 768px) 100vw, 1200px"
      style={{ width: "100%", height: "auto" }}
    />
  );

  return node.href ? (
    <Link href={node.href} className="kcp-b-image-link">{image}</Link>
  ) : (
    image
  );
}

function WidgetView({ node, editing, selectedId }: { node: WidgetNode; editing: boolean; selectedId?: string }) {
  const className = `kcp-b-widget kcp-b-${node.id} kcp-b-${node.kind}${selectedId === node.id ? " is-selected" : ""}`;

  switch (node.kind) {
    case "heading": {
      const Heading = node.level === 1 ? "h1" : node.level === 3 ? "h3" : "h2";
      return <Heading className={className} data-b-id={node.id}>{node.text}</Heading>;
    }
    case "text":
      return <p className={className} data-b-id={node.id}>{node.text}</p>;
    case "image":
      return (
        <div className={className} data-b-id={node.id}>
          <ImageWidget node={node} editing={editing} />
        </div>
      );
    case "button":
      return (
        <p className={className} data-b-id={node.id}>
          <Link href={node.href} className={`btn${node.variant === "outline" ? " btn-outline" : ""}`}>
            {node.text}
          </Link>
        </p>
      );
    case "spacer":
      return <div className={className} data-b-id={node.id} style={{ height: `${node.height}px` }} aria-hidden="true" />;
    case "divider":
      return <hr className={className} data-b-id={node.id} />;
    case "faq":
      return node.items.length ? (
        <div className={`${className} kcp-faq-list`} data-b-id={node.id}>
          {node.items.map((item, index) => (
            <details key={index}>
              <summary>
                {item.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      ) : editing ? (
        <span className="kcp-b-empty" data-b-id={node.id}>Add a question in the panel on the right.</span>
      ) : null;
    default:
      return null;
  }
}

function ColumnView({ column, editing, selectedId }: { column: ColumnNode; editing: boolean; selectedId?: string }) {
  return (
    <div
      className={`kcp-b-column kcp-b-${column.id}${selectedId === column.id ? " is-selected" : ""}`}
      data-b-id={column.id}
      data-b-column={column.id}
    >
      {column.widgets.map((widget) => (
        <WidgetView key={widget.id} node={widget} editing={editing} selectedId={selectedId} />
      ))}
      {editing && !column.widgets.length ? <span className="kcp-b-empty">Drop a block here.</span> : null}
    </div>
  );
}

function SectionView({ section, editing, selectedId }: { section: SectionNode; editing: boolean; selectedId?: string }) {
  return (
    <section
      className={`kcp-b-section kcp-b-${section.id}${section.boxed ? " kcp-b-boxed" : ""}${selectedId === section.id ? " is-selected" : ""}`}
      data-b-id={section.id}
    >
      <div className="kcp-b-row">
        {section.columns.map((column) => (
          <ColumnView key={column.id} column={column} editing={editing} selectedId={selectedId} />
        ))}
      </div>
    </section>
  );
}

export default function BuilderPageView({
  page,
  editing = false,
  selectedId,
}: {
  page: PageShape;
  editing?: boolean;
  selectedId?: string;
}) {
  const css = builderStylesheet(page.layout);
  const hasContent = page.layout.sections.some((section) =>
    section.columns.some((column) => column.widgets.length > 0)
  );

  return (
    <div className="builder-page">
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {page.showTitle || page.description ? (
        <header className="kcp-b-header kcp-b-boxed">
          {page.showTitle && page.title ? <h1>{page.title}</h1> : null}
          {page.description ? <p>{page.description}</p> : null}
        </header>
      ) : null}
      {page.layout.sections.map((section) => (
        <SectionView key={section.id} section={section} editing={editing} selectedId={selectedId} />
      ))}
      {!hasContent ? (
        <p className="kcp-b-empty kcp-b-boxed">
          {editing ? "Start by adding a block from the left panel." : ""}
        </p>
      ) : null}
    </div>
  );
}
