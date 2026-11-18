"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import ContactForm from "@/components/ContactForm";
import type { SiteSettings } from "@/lib/catalog-types";
import type { Product } from "@/lib/types";
import {
  WIDGET_LABELS,
  type Breakpoint,
  type BuilderPage,
  type ColumnNode,
  type SectionNode,
  type WidgetNode,
} from "@/lib/builder/schema";
import { builderStylesheet, effectiveStyle } from "@/lib/builder/styles";

export type DropLocation =
  | { kind: "section"; index: number }
  | { kind: "widget"; columnId: string; index: number };

export type BuilderEditorCallbacks = {
  selectedId: string | null;
  breakpoint: Breakpoint;
  draggingKind: "new-widget" | "new-section" | "widget" | "section" | null;
  dropLocation: DropLocation | null;
  onSelect: (id: string | null) => void;
  onInlineCommit: (widgetId: string, patch: Record<string, unknown>) => void;
  onDragStartNode: (kind: "section" | "widget", id: string, event: DragEvent) => void;
  onDragEndNode: () => void;
  onDragOverLocation: (location: DropLocation | null) => void;
  onDropAtLocation: (location: DropLocation) => void;
  onAddSectionAfter: (sectionIndex: number) => void;
  onColumnPreset: (sectionId: string, widths: number[]) => void;
  onDuplicateNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onColumnResize: (sectionId: string, leftIndex: number, nextLeftWidth: number, commit: boolean) => void;
  onColumnQuickAdd: (columnId: string) => void;
};

type PageShape = Pick<BuilderPage, "title" | "description" | "showTitle" | "layout">;

function InlineEditableText({
  value,
  editing,
  selected,
  multiline = false,
  maxLength,
  placeholder = "Click to edit",
  className,
  tag: Tag = "span",
  activeKey,
  fieldKey,
  onActivate,
  onCommit,
}: {
  value: string;
  editing: boolean;
  selected: boolean;
  multiline?: boolean;
  maxLength: number;
  placeholder?: string;
  className?: string;
  tag?: "span" | "p" | "h1" | "h2" | "h3" | "div" | "strong";
  activeKey: string | null;
  fieldKey: string;
  onActivate: (key: string | null) => void;
  onCommit: (nextValue: string) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const isEditing = editing && activeKey === fieldKey;

  useEffect(() => {
    const el = ref.current;
    if (!el || !isEditing) return;
    if (el.innerText !== value) el.innerText = value;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [isEditing, value]);

  if (!editing) {
    return <Tag className={className}>{value}</Tag>;
  }

  function finish(commitValue: boolean) {
    const el = ref.current;
    onActivate(null);
    if (!commitValue || !el) return;
    const raw = (el.innerText ?? "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
    const cleaned = (multiline ? raw : raw.replace(/\n+/g, " ")).slice(0, maxLength);
    if (cleaned !== value) onCommit(cleaned);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (ref.current) ref.current.innerText = value;
      finish(false);
    } else if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    }
  }

  return (
    <Tag
      ref={ref as never}
      className={`${className ?? ""} kcp-b-inline-text${isEditing ? " is-inline-editing" : ""}`}
      data-inline-field={fieldKey}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={(event) => {
        if (isEditing) {
          event.stopPropagation();
          return;
        }
        if (selected) {
          event.stopPropagation();
          onActivate(fieldKey);
        }
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onActivate(fieldKey);
      }}
      onBlur={() => {
        if (isEditing) finish(true);
      }}
      onKeyDown={isEditing ? handleKeyDown : undefined}
      onPaste={(event) => {
        if (!isEditing) return;
        event.preventDefault();
        const plain = event.clipboardData.getData("text/plain");
        const insert = multiline ? plain : plain.replace(/[\r\n]+/g, " ");
        document.execCommand("insertText", false, insert);
      }}
    >
      {value || (isEditing ? "" : placeholder)}
    </Tag>
  );
}

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

  return node.href && !editing ? (
    <Link href={node.href} className="kcp-b-image-link">{image}</Link>
  ) : (
    image
  );
}

function ProductGridWidget({
  node,
  editing,
  products,
  activeKey,
  selected,
  onActivate,
  onCommit,
}: {
  node: Extract<WidgetNode, { kind: "product-grid" }>;
  editing: boolean;
  products: Product[];
  activeKey: string | null;
  selected: boolean;
  onActivate: (key: string | null) => void;
  onCommit: (patch: Record<string, unknown>) => void;
}) {
  const filtered = products
    .filter((p) => !node.categorySlug || p.categorySlug === node.categorySlug)
    .filter((p) => {
      if (!node.kindFilter) return true;
      if (node.kindFilter === "fleece") return p.kind === "hoodie" || p.kind === "crew";
      return p.kind === node.kindFilter;
    })
    .filter((p) => !node.featuredOnly || p.featured);
  const shown = filtered.slice(0, node.limit);

  if (!shown.length && !editing) return null;

  return (
    <div className="kcp-b-product-grid-wrap">
      {(node.heading || node.subheading || node.ctaText) && (
        <div className="kcp-b-section-header">
          <div>
            {(node.heading || editing) && (
              <InlineEditableText
                tag="h2"
                className="kcp-b-section-heading"
                value={node.heading}
                placeholder="Section heading"
                editing={editing}
                selected={selected}
                maxLength={200}
                activeKey={activeKey}
                fieldKey={`${node.id}:heading`}
                onActivate={onActivate}
                onCommit={(heading) => onCommit({ heading })}
              />
            )}
            {(node.subheading || editing) && (
              <InlineEditableText
                tag="p"
                className="kcp-b-section-sub"
                value={node.subheading}
                placeholder="Add a short description"
                editing={editing}
                selected={selected}
                multiline
                maxLength={350}
                activeKey={activeKey}
                fieldKey={`${node.id}:subheading`}
                onActivate={onActivate}
                onCommit={(subheading) => onCommit({ subheading })}
              />
            )}
          </div>
          {node.ctaText && node.ctaHref ? (
            <Link href={node.ctaHref} className="kcp-text-link">
              {node.ctaText}
            </Link>
          ) : null}
        </div>
      )}

      {shown.length ? (
        <ul className={`kcp-b-product-grid kcp-b-cols-${node.columns}`}>
          {shown.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="kcp-b-empty">No matching products yet. Adjust the category, type, or featured filter on the right.</p>
      )}
    </div>
  );
}

function WidgetView({
  node,
  editing,
  callbacks,
  products,
  settings,
  canSendEmail,
  activeKey,
  onActivate,
}: {
  node: WidgetNode;
  editing: boolean;
  callbacks?: BuilderEditorCallbacks;
  products: Product[];
  settings?: SiteSettings;
  canSendEmail: boolean;
  activeKey: string | null;
  onActivate: (key: string | null) => void;
}) {
  const isSelected = Boolean(editing && callbacks?.selectedId === node.id);
  const className = `kcp-b-widget kcp-b-${node.id} kcp-b-${node.kind}${isSelected ? " is-selected" : ""}`;

  const commit = (patch: Record<string, unknown>) => callbacks?.onInlineCommit(node.id, patch);

  let content: ReactNode = null;
  switch (node.kind) {
    case "heading": {
      const tag = node.level === 1 ? "h1" : node.level === 3 ? "h3" : "h2";
      content = (
        <InlineEditableText
          tag={tag}
          value={node.text}
          editing={editing}
          selected={isSelected}
          maxLength={200}
          activeKey={activeKey}
          fieldKey={`${node.id}:text`}
          onActivate={onActivate}
          onCommit={(text) => commit({ text })}
        />
      );
      break;
    }
    case "text":
      content = (
        <InlineEditableText
          tag="p"
          value={node.text}
          editing={editing}
          selected={isSelected}
          multiline
          maxLength={4000}
          activeKey={activeKey}
          fieldKey={`${node.id}:text`}
          onActivate={onActivate}
          onCommit={(text) => commit({ text })}
        />
      );
      break;
    case "image":
      content = <ImageWidget node={node} editing={editing} />;
      break;
    case "button":
      content = (
        <p>
          <Link href={node.href} className={`btn${node.variant === "outline" ? " btn-outline" : ""}`}>
            <InlineEditableText
              tag="span"
              value={node.text}
              editing={editing}
              selected={isSelected}
              maxLength={80}
              activeKey={activeKey}
              fieldKey={`${node.id}:text`}
              onActivate={onActivate}
              onCommit={(text) => commit({ text })}
            />
          </Link>
        </p>
      );
      break;
    case "spacer":
      content = (
        <div
          className="kcp-b-spacer-box"
          style={{ height: `${node.height}px` }}
          aria-hidden={!editing}
        >
          {editing ? <span className="kcp-b-spacer-label">Spacer · {node.height}px</span> : null}
        </div>
      );
      break;
    case "divider":
      content = <hr className="kcp-b-divider-line" />;
      break;
    case "faq":
      content = node.items.length ? (
        <div className="kcp-faq-list">
          {node.items.map((item, index) => (
            <details key={index} open={editing ? true : undefined}>
              <summary>
                <InlineEditableText
                  tag="span"
                  value={item.question}
                  placeholder="Question"
                  editing={editing}
                  selected={isSelected}
                  maxLength={160}
                  activeKey={activeKey}
                  fieldKey={`${node.id}:q:${index}`}
                  onActivate={onActivate}
                  onCommit={(question) => {
                    const items = node.items.map((entry, idx) => (idx === index ? { ...entry, question } : entry));
                    commit({ items });
                  }}
                />
                <span aria-hidden="true">+</span>
              </summary>
              <InlineEditableText
                tag="p"
                value={item.answer}
                placeholder="Answer"
                editing={editing}
                selected={isSelected}
                multiline
                maxLength={900}
                activeKey={activeKey}
                fieldKey={`${node.id}:a:${index}`}
                onActivate={onActivate}
                onCommit={(answer) => {
                  const items = node.items.map((entry, idx) => (idx === index ? { ...entry, answer } : entry));
                  commit({ items });
                }}
              />
            </details>
          ))}
        </div>
      ) : editing ? (
        <span className="kcp-b-empty">Add a question in the panel on the right.</span>
      ) : null;
      break;
    case "promo-banner":
      content = (
        <div
          className={`kcp-b-promo is-${node.theme} is-align-${node.align}`}
          style={{ minHeight: `${node.minHeight}px` }}
        >
          {node.imageSrc ? (
            <>
              <Image
                src={node.imageSrc}
                alt={node.imageAlt || ""}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                className="kcp-b-promo-img"
              />
              <span
                className="kcp-b-promo-shade"
                aria-hidden="true"
                style={{ opacity: node.overlay / 100 }}
              />
            </>
          ) : null}
          <div className="kcp-b-promo-body">
            {(node.eyebrow || editing) && (
              <InlineEditableText
                tag="span"
                className="kcp-b-promo-eyebrow"
                value={node.eyebrow}
                placeholder="Eyebrow"
                editing={editing}
                selected={isSelected}
                maxLength={80}
                activeKey={activeKey}
                fieldKey={`${node.id}:eyebrow`}
                onActivate={onActivate}
                onCommit={(eyebrow) => commit({ eyebrow })}
              />
            )}
            {(node.heading || editing) && (
              <InlineEditableText
                tag="h2"
                className="kcp-b-promo-title"
                value={node.heading}
                placeholder="Banner headline"
                editing={editing}
                selected={isSelected}
                maxLength={200}
                activeKey={activeKey}
                fieldKey={`${node.id}:heading`}
                onActivate={onActivate}
                onCommit={(heading) => commit({ heading })}
              />
            )}
            {(node.body || editing) && (
              <InlineEditableText
                tag="p"
                className="kcp-b-promo-text"
                value={node.body}
                placeholder="Supporting description"
                editing={editing}
                selected={isSelected}
                multiline
                maxLength={600}
                activeKey={activeKey}
                fieldKey={`${node.id}:body`}
                onActivate={onActivate}
                onCommit={(body) => commit({ body })}
              />
            )}
            {(node.ctaText && node.ctaHref) || (node.secondaryCtaText && node.secondaryCtaHref) ? (
              <div className="kcp-b-promo-actions">
                {node.ctaText && node.ctaHref ? (
                  <Link href={node.ctaHref} className={node.theme === "dark" ? "btn btn-white" : "btn"}>
                    {node.ctaText}
                  </Link>
                ) : null}
                {node.secondaryCtaText && node.secondaryCtaHref ? (
                  <Link
                    href={node.secondaryCtaHref}
                    className={node.theme === "dark" ? "btn btn-outline-light" : "btn btn-ghost"}
                  >
                    {node.secondaryCtaText}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      );
      break;
    case "product-grid":
      content = (
        <ProductGridWidget
          node={node}
          editing={editing}
          products={products}
          activeKey={activeKey}
          selected={isSelected}
          onActivate={onActivate}
          onCommit={commit}
        />
      );
      break;
    case "category-strip":
      content = (
        <div className="kcp-b-catstrip-wrap">
          {node.heading || editing ? (
            <InlineEditableText
              tag="h2"
              className="kcp-b-section-heading"
              value={node.heading}
              placeholder="Categories heading"
              editing={editing}
              selected={isSelected}
              maxLength={200}
              activeKey={activeKey}
              fieldKey={`${node.id}:heading`}
              onActivate={onActivate}
              onCommit={(heading) => commit({ heading })}
            />
          ) : null}
          <nav className="kcp-b-catstrip" aria-label={node.heading || "Shop by category"}>
            {node.items.map((item, idx) => (
              <Link key={idx} href={item.href} className="kcp-b-catstrip-item">
                {item.imageSrc ? (
                  <span className="kcp-b-catstrip-thumb">
                    <Image src={item.imageSrc} alt="" fill sizes="96px" />
                  </span>
                ) : null}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      );
      break;
    case "feature-cards":
      content = (
        <div className="kcp-b-features-wrap">
          {node.heading || node.subheading || editing ? (
            <div className="kcp-b-section-header">
              <div>
                {(node.heading || editing) && (
                  <InlineEditableText
                    tag="h2"
                    className="kcp-b-section-heading"
                    value={node.heading}
                    placeholder="Features heading"
                    editing={editing}
                    selected={isSelected}
                    maxLength={200}
                    activeKey={activeKey}
                    fieldKey={`${node.id}:heading`}
                    onActivate={onActivate}
                    onCommit={(heading) => commit({ heading })}
                  />
                )}
                {(node.subheading || editing) && (
                  <InlineEditableText
                    tag="p"
                    className="kcp-b-section-sub"
                    value={node.subheading}
                    placeholder="Add a short introduction"
                    editing={editing}
                    selected={isSelected}
                    multiline
                    maxLength={350}
                    activeKey={activeKey}
                    fieldKey={`${node.id}:subheading`}
                    onActivate={onActivate}
                    onCommit={(subheading) => commit({ subheading })}
                  />
                )}
              </div>
            </div>
          ) : null}
          <div className={`kcp-b-feature-grid kcp-b-cols-${node.columns} is-${node.variant}`}>
            {node.items.map((item, index) => (
              <article key={index} className="kcp-b-feature-card">
                {item.badge ? <span className="kcp-b-feature-badge tnum">{item.badge}</span> : null}
                <InlineEditableText
                  tag="h3"
                  className="kcp-b-feature-title"
                  value={item.title}
                  placeholder="Card title"
                  editing={editing}
                  selected={isSelected}
                  maxLength={120}
                  activeKey={activeKey}
                  fieldKey={`${node.id}:title:${index}`}
                  onActivate={onActivate}
                  onCommit={(title) => {
                    const items = node.items.map((entry, idx) => (idx === index ? { ...entry, title } : entry));
                    commit({ items });
                  }}
                />
                <InlineEditableText
                  tag="p"
                  className="kcp-b-feature-body"
                  value={item.body}
                  placeholder="Card description"
                  editing={editing}
                  selected={isSelected}
                  multiline
                  maxLength={500}
                  activeKey={activeKey}
                  fieldKey={`${node.id}:body:${index}`}
                  onActivate={onActivate}
                  onCommit={(body) => {
                    const items = node.items.map((entry, idx) => (idx === index ? { ...entry, body } : entry));
                    commit({ items });
                  }}
                />
              </article>
            ))}
          </div>
        </div>
      );
      break;
    case "image-gallery":
      content = (
        <div className="kcp-b-gallery-wrap">
          {node.heading || editing ? (
            <InlineEditableText
              tag="h2"
              className="kcp-b-section-heading"
              value={node.heading}
              placeholder="Gallery heading"
              editing={editing}
              selected={isSelected}
              maxLength={200}
              activeKey={activeKey}
              fieldKey={`${node.id}:heading`}
              onActivate={onActivate}
              onCommit={(heading) => commit({ heading })}
            />
          ) : null}
          <div className={`kcp-b-gallery kcp-b-cols-${node.columns}`}>
            {node.items.map((item, idx) => {
              const card = (
                <figure className="kcp-b-gallery-item">
                  <div className="kcp-b-gallery-frame" style={{ aspectRatio: String(node.aspectRatio) }}>
                    {item.src ? (
                      <Image src={item.src} alt={item.alt} fill sizes="(max-width: 768px) 50vw, 320px" style={{ objectFit: "cover" }} />
                    ) : (
                      <span className="kcp-b-empty">Choose image</span>
                    )}
                  </div>
                  {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                </figure>
              );
              return item.href && !editing ? (
                <Link key={idx} href={item.href} className="kcp-b-gallery-link">
                  {card}
                </Link>
              ) : (
                <div key={idx}>{card}</div>
              );
            })}
          </div>
        </div>
      );
      break;
    case "contact-block": {
      const contactEmail = settings?.contactEmail ?? "";
      return (
        <div
          className={className}
          data-b-id={node.id}
          data-b-widget={node.id}
          onClick={
            editing
              ? (event) => {
                  event.stopPropagation();
                  callbacks?.onSelect(node.id);
                }
              : undefined
          }
        >
          {editing ? <WidgetToolbar node={node} callbacks={callbacks} /> : null}
          <div className="kcp-b-contact-block">
            <div className="kcp-b-contact-main">
              {(node.heading || editing) && (
                <InlineEditableText
                  tag="h2"
                  className="kcp-b-section-heading"
                  value={node.heading}
                  placeholder="Contact heading"
                  editing={editing}
                  selected={isSelected}
                  maxLength={200}
                  activeKey={activeKey}
                  fieldKey={`${node.id}:heading`}
                  onActivate={onActivate}
                  onCommit={(heading) => commit({ heading })}
                />
              )}
              {(node.body || editing) && (
                <InlineEditableText
                  tag="p"
                  className="kcp-b-section-sub"
                  value={node.body}
                  placeholder="Contact introduction"
                  editing={editing}
                  selected={isSelected}
                  multiline
                  maxLength={600}
                  activeKey={activeKey}
                  fieldKey={`${node.id}:body`}
                  onActivate={onActivate}
                  onCommit={(body) => commit({ body })}
                />
              )}
              <div className={editing ? "kcp-b-form-preview" : undefined}>
                <ContactForm contactEmail={contactEmail} canSend={editing ? false : canSendEmail} />
              </div>
            </div>
            {(node.showDetails || node.showQuickLinks) && (
              <aside className="contact-side" aria-label="Contact details">
                {node.showDetails && (
                  <div className="panel panel-pad">
                    <h3 className="h3">Direct</h3>
                    <dl className="contact-list">
                      {contactEmail ? (
                        <div>
                          <dt>Email</dt>
                          <dd><a href={`mailto:${contactEmail}`}>{contactEmail}</a></dd>
                        </div>
                      ) : null}
                      {settings?.contactPhone ? (
                        <div>
                          <dt>Phone</dt>
                          <dd>{settings.contactPhone}</dd>
                        </div>
                      ) : null}
                      {settings?.businessAddress ? (
                        <div>
                          <dt>Address</dt>
                          <dd>{settings.businessAddress}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Production time</dt>
                        <dd>{settings?.productionDays || "3-5 business days after artwork approval"}</dd>
                      </div>
                    </dl>
                  </div>
                )}
                {node.showQuickLinks && (
                  <div className="panel panel-pad">
                    <h3 className="h3">Faster answers</h3>
                    <ul className="quick-links">
                      <li><Link href="/faq">Frequently asked questions</Link></li>
                      <li><Link href="/shipping">Shipping and returns</Link></li>
                    </ul>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>
      );
    }
    default:
      return null;
  }

  return (
    <div
      className={className}
      data-b-id={node.id}
      data-b-widget={node.id}
      onClick={
        editing
          ? (event) => {
              event.stopPropagation();
              callbacks?.onSelect(node.id);
            }
          : undefined
      }
    >
      {editing ? <WidgetToolbar node={node} callbacks={callbacks} /> : null}
      {content}
    </div>
  );
}

function WidgetToolbar({ node, callbacks }: { node: WidgetNode; callbacks?: BuilderEditorCallbacks }) {
  return (
    <div className="kcp-b-toolbar kcp-b-widget-toolbar" onClick={(e) => e.stopPropagation()}>
      <span
        className="kcp-b-drag-handle"
        role="button"
        tabIndex={0}
        title="Drag to reorder block"
        aria-label={`Drag ${WIDGET_LABELS[node.kind]}`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          callbacks?.onDragStartNode("widget", node.id, e);
        }}
        onDragEnd={() => callbacks?.onDragEndNode()}
      >
        ⋮⋮
      </span>
      <span className="kcp-b-toolbar-title">{WIDGET_LABELS[node.kind]}</span>
      <button
        type="button"
        title="Duplicate block"
        aria-label={`Duplicate ${WIDGET_LABELS[node.kind]}`}
        onClick={() => callbacks?.onDuplicateNode(node.id)}
      >
        ⧉
      </button>
      <button
        type="button"
        className="is-danger"
        title="Delete block"
        aria-label={`Delete ${WIDGET_LABELS[node.kind]}`}
        onClick={() => callbacks?.onDeleteNode(node.id)}
      >
        ×
      </button>
    </div>
  );
}

function ColumnView({
  column,
  editing,
  callbacks,
  products,
  settings,
  canSendEmail,
  activeKey,
  onActivate,
}: {
  column: ColumnNode;
  editing: boolean;
  callbacks?: BuilderEditorCallbacks;
  products: Product[];
  settings?: SiteSettings;
  canSendEmail: boolean;
  activeKey: string | null;
  onActivate: (key: string | null) => void;
}) {
  const isSelected = Boolean(editing && callbacks?.selectedId === column.id);
  const dropLoc = callbacks?.dropLocation;
  const isWidgetDrop = dropLoc?.kind === "widget" && dropLoc.columnId === column.id;

  function computeWidgetDropIndex(event: DragEvent<HTMLDivElement>): number {
    const children = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(":scope > .kcp-b-widget-slot")
    );
    for (let i = 0; i < children.length; i += 1) {
      const rect = children[i].getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) return i;
    }
    return children.length;
  }

  return (
    <div
      className={`kcp-b-column kcp-b-${column.id}${isSelected ? " is-selected" : ""}${isWidgetDrop ? " is-drop-active" : ""}`}
      data-b-id={column.id}
      data-b-column={column.id}
      onClick={
        editing
          ? (event) => {
              event.stopPropagation();
              callbacks?.onSelect(column.id);
            }
          : undefined
      }
      onDragOver={
        editing && callbacks && callbacks.draggingKind !== "section" && callbacks.draggingKind !== "new-section"
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const index = computeWidgetDropIndex(event);
              callbacks.onDragOverLocation({ kind: "widget", columnId: column.id, index });
            }
          : undefined
      }
      onDrop={
        editing && callbacks && callbacks.draggingKind !== "section" && callbacks.draggingKind !== "new-section"
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              const index = computeWidgetDropIndex(event);
              callbacks.onDropAtLocation({ kind: "widget", columnId: column.id, index });
            }
          : undefined
      }
    >
      {column.backgroundImage ? (
        <div className="kcp-b-bg" aria-hidden="true">
          <Image src={column.backgroundImage} alt="" fill sizes="(max-width: 768px) 100vw, 600px" style={{ objectFit: "cover" }} />
          {column.backgroundOverlay ? (
            <span className="kcp-b-bg-overlay" style={{ opacity: column.backgroundOverlay / 100 }} />
          ) : null}
        </div>
      ) : null}

      {column.widgets.map((widget, idx) => (
        <div key={widget.id} className="kcp-b-widget-slot">
          {isWidgetDrop && dropLoc.index === idx ? <div className="kcp-b-drop-line" aria-hidden="true" /> : null}
          <WidgetView
            node={widget}
            editing={editing}
            callbacks={callbacks}
            products={products}
            settings={settings}
            canSendEmail={canSendEmail}
            activeKey={activeKey}
            onActivate={onActivate}
          />
        </div>
      ))}

      {isWidgetDrop && dropLoc.index >= column.widgets.length ? (
        <div className="kcp-b-drop-line" aria-hidden="true" />
      ) : null}

      {editing && !column.widgets.length ? (
        <button
          type="button"
          className="kcp-b-empty-col-btn"
          onClick={(event) => {
            event.stopPropagation();
            callbacks?.onColumnQuickAdd(column.id);
          }}
        >
          + Drop a block here or click to add
        </button>
      ) : null}
    </div>
  );
}

const COLUMN_PRESETS: { label: string; title: string; widths: number[] }[] = [
  { label: "1", title: "1 column (100%)", widths: [100] },
  { label: "2", title: "2 equal columns (50 / 50)", widths: [50, 50] },
  { label: "1/3+2/3", title: "Sidebar left (33 / 67)", widths: [33, 67] },
  { label: "2/3+1/3", title: "Sidebar right (67 / 33)", widths: [67, 33] },
  { label: "3", title: "3 columns", widths: [33, 34, 33] },
  { label: "4", title: "4 columns", widths: [25, 25, 25, 25] },
];

function SectionView({
  section,
  sectionIndex,
  editing,
  callbacks,
  products,
  settings,
  canSendEmail,
  activeKey,
  onActivate,
}: {
  section: SectionNode;
  sectionIndex: number;
  editing: boolean;
  callbacks?: BuilderEditorCallbacks;
  products: Product[];
  settings?: SiteSettings;
  canSendEmail: boolean;
  activeKey: string | null;
  onActivate: (key: string | null) => void;
}) {
  const isSelected = Boolean(editing && callbacks?.selectedId === section.id);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [liveSplit, setLiveSplit] = useState<string | null>(null);

  function startResize(leftIndex: number, event: React.PointerEvent<HTMLButtonElement>) {
    if (!editing || !callbacks || !rowRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rowRect = rowRef.current.getBoundingClientRect();
    if (!rowRect.width) return;

    const leftCol = section.columns[leftIndex];
    const startWidth =
      effectiveStyle(leftCol, callbacks.breakpoint).columnWidth ??
      Math.round(100 / section.columns.length);
    const startX = event.clientX;
    let latest = startWidth;
    setLiveSplit(`${Math.round(startWidth)}%`);

    const onMove = (moveEvent: PointerEvent) => {
      const deltaPct = ((moveEvent.clientX - startX) / rowRect.width) * 100;
      latest = Math.max(15, Math.min(85, Math.round(startWidth + deltaPct)));
      setLiveSplit(`${latest}%`);
      callbacks.onColumnResize(section.id, leftIndex, latest, false);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setLiveSplit(null);
      callbacks.onColumnResize(section.id, leftIndex, latest, true);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <section
      className={`kcp-b-section kcp-b-${section.id}${section.boxed ? " kcp-b-boxed" : ""}${isSelected ? " is-selected" : ""}`}
      data-b-id={section.id}
      data-b-section={section.id}
      onClick={
        editing
          ? (event) => {
              event.stopPropagation();
              callbacks?.onSelect(section.id);
            }
          : undefined
      }
    >
      {section.backgroundImage ? (
        <div className="kcp-b-bg" aria-hidden="true">
          <Image src={section.backgroundImage} alt="" fill sizes="100vw" style={{ objectFit: "cover" }} />
          {section.backgroundOverlay ? (
            <span className="kcp-b-bg-overlay" style={{ opacity: section.backgroundOverlay / 100 }} />
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="kcp-b-toolbar kcp-b-section-toolbar" onClick={(e) => e.stopPropagation()}>
          <span
            className="kcp-b-drag-handle"
            role="button"
            tabIndex={0}
            title="Drag to reorder section"
            aria-label={`Drag section ${sectionIndex + 1}`}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              callbacks?.onDragStartNode("section", section.id, e);
            }}
            onDragEnd={() => callbacks?.onDragEndNode()}
          >
            ⋮⋮
          </span>
          <span className="kcp-b-toolbar-title">Section {sectionIndex + 1}</span>
          <span className="kcp-b-presets" role="group" aria-label="Column layout">
            {COLUMN_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                title={preset.title}
                onClick={() => callbacks?.onColumnPreset(section.id, preset.widths)}
              >
                {preset.label}
              </button>
            ))}
          </span>
          <button
            type="button"
            title="Add section below"
            aria-label="Add section below"
            onClick={() => callbacks?.onAddSectionAfter(sectionIndex)}
          >
            +
          </button>
          <button
            type="button"
            title="Duplicate section"
            aria-label="Duplicate section"
            onClick={() => callbacks?.onDuplicateNode(section.id)}
          >
            ⧉
          </button>
          <button
            type="button"
            className="is-danger"
            title="Delete section"
            aria-label="Delete section"
            onClick={() => callbacks?.onDeleteNode(section.id)}
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="kcp-b-row" ref={rowRef}>
        {section.columns.map((column, colIdx) => (
          <div
            key={column.id}
            className={`kcp-b-col-shell kcp-b-${column.id}`}
          >
            <ColumnView
              column={{ ...column, style: column.style }}
              editing={editing}
              callbacks={callbacks}
              products={products}
              settings={settings}
              canSendEmail={canSendEmail}
              activeKey={activeKey}
              onActivate={onActivate}
            />
            {editing && colIdx < section.columns.length - 1 ? (
              <button
                type="button"
                className="kcp-b-col-resizer"
                aria-label={`Resize column ${colIdx + 1}`}
                title="Drag to resize columns"
                onPointerDown={(e) => startResize(colIdx, e)}
              >
                {liveSplit ? <span className="kcp-b-col-pill">{liveSplit}</span> : null}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BuilderPageView({
  page,
  editing = false,
  selectedId,
  callbacks,
  products = [],
  settings,
  canSendEmail = false,
}: {
  page: PageShape;
  editing?: boolean;
  selectedId?: string;
  callbacks?: BuilderEditorCallbacks;
  products?: Product[];
  settings?: SiteSettings;
  canSendEmail?: boolean;
}) {
  const [activeInlineKey, setActiveInlineKey] = useState<string | null>(null);
  const css = builderStylesheet(page.layout);
  const resolvedSelectedId = callbacks?.selectedId ?? selectedId;
  const effectiveCallbacks: BuilderEditorCallbacks | undefined = callbacks
    ? callbacks
    : editing && resolvedSelectedId
      ? {
          selectedId: resolvedSelectedId,
          breakpoint: "desktop",
          draggingKind: null,
          dropLocation: null,
          onSelect: () => {},
          onInlineCommit: () => {},
          onDragStartNode: () => {},
          onDragEndNode: () => {},
          onDragOverLocation: () => {},
          onDropAtLocation: () => {},
          onAddSectionAfter: () => {},
          onColumnPreset: () => {},
          onDuplicateNode: () => {},
          onDeleteNode: () => {},
          onColumnResize: () => {},
          onColumnQuickAdd: () => {},
        }
      : undefined;

  const hasContent = page.layout.sections.some((section) =>
    section.columns.some((column) => column.widgets.length > 0)
  );

  const dropLoc = callbacks?.dropLocation;

  function computeSectionDropIndex(event: DragEvent<HTMLDivElement>): number {
    const sections = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-b-section]")
    );
    for (let i = 0; i < sections.length; i += 1) {
      const rect = sections[i].getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) return i;
    }
    return sections.length;
  }

  return (
    <div
      className="builder-page"
      onDragOver={
        editing && callbacks
          ? (event) => {
              if (callbacks.draggingKind === "widget" || callbacks.draggingKind === "new-widget") return;
              event.preventDefault();
              const index = computeSectionDropIndex(event);
              callbacks.onDragOverLocation({ kind: "section", index });
            }
          : undefined
      }
      onDrop={
        editing && callbacks
          ? (event) => {
              if (callbacks.draggingKind === "widget" || callbacks.draggingKind === "new-widget") return;
              event.preventDefault();
              const index = computeSectionDropIndex(event);
              callbacks.onDropAtLocation({ kind: "section", index });
            }
          : undefined
      }
    >
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {page.showTitle || page.description ? (
        <header className="kcp-b-header kcp-b-boxed">
          {page.showTitle && page.title ? <h1>{page.title}</h1> : null}
          {page.description ? <p>{page.description}</p> : null}
        </header>
      ) : null}
      {page.layout.sections.map((section, idx) => (
        <div key={section.id} className="kcp-b-section-slot">
          {dropLoc?.kind === "section" && dropLoc.index === idx ? (
            <div className="kcp-b-drop-line is-section-drop" aria-hidden="true" />
          ) : null}
          <SectionView
            section={section}
            sectionIndex={idx}
            editing={editing}
            callbacks={effectiveCallbacks}
            products={products}
            settings={settings}
            canSendEmail={canSendEmail}
            activeKey={activeInlineKey}
            onActivate={setActiveInlineKey}
          />
        </div>
      ))}
      {dropLoc?.kind === "section" && dropLoc.index >= page.layout.sections.length ? (
        <div className="kcp-b-drop-line is-section-drop" aria-hidden="true" />
      ) : null}
      {!hasContent ? (
        <p className="kcp-b-empty kcp-b-boxed">
          {editing ? "Start by dragging a block or section template from the left panel." : ""}
        </p>
      ) : null}
    </div>
  );
}
