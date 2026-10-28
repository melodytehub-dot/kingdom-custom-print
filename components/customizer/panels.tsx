"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { DesignLayer, GarmentSide, ImageLayer, Product, RosterEntry, TextLayer } from "@/lib/types";
import { newTextLayer } from "@/lib/design";
import { sizeDisplayLabel, splitSizeGroups } from "@/lib/sizes";
import type { SavedDraft } from "@/lib/design";
import { PERSONALIZATION_FEE, formatUSD, lowestPrintedUnit, type PriceQuote } from "@/lib/pricing";
import { sizeSummary } from "@/lib/sizes";
import { TEE_MOCKUPS, type TeeMockup } from "@/lib/mockups";
import { FONTS, svgFontStack } from "@/lib/fonts";
import { ART_CATEGORIES, ART_LIBRARY, type ArtItem } from "./art";
import { DESIGN_TEMPLATES, TEMPLATE_CATEGORIES, type DesignTemplate } from "./templates";
import { useLumiseLibrary } from "./lumise-library";
import {
  ColorView,
  PanelHeader,
  Swatch,
  inkName,
} from "./editors";
import { CheckGlyph, DuplicateIcon, GroupIcon, MinusGlyph, PlusGlyph, TrashIcon, UngroupIcon } from "./icons";
import { useMemo, useState } from "react";

/* -------------------------------------------------------------------------
   Products
   ------------------------------------------------------------------------- */

export function ProductsPanel({
  product,
  products,
  mockup,
  mockups,
  onColor,
  onSwitchProduct,
  onClose,
}: {
  product: Product;
  products: Product[];
  mockup: TeeMockup;
  mockups: TeeMockup[];
  onColor: (code: string) => void;
  onSwitchProduct: (product: Product) => boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const [color, setColor] = useState("all");
  const [sort, setSort] = useState("featured");
  const categories = [...new Set(products.map((item) => item.categoryName).filter((value): value is string => Boolean(value)))];
  const kinds = [...new Set(products.map((item) => item.kind))];
  const colors = [...new Set(products.flatMap((item) => item.colors.map((variant) => variant.name)))].sort();
  const visibleProducts = products
    .filter((item) => {
      const text = `${item.name} ${item.styleCode} ${item.material} ${item.categoryName ?? ""}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase()))
        && (category === "all" || item.categoryName === category)
        && (kind === "all" || item.kind === kind)
        && (color === "all" || item.colors.some((variant) => variant.name === color));
    })
    .sort((a, b) => sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "price"
        ? a.basePrice - b.basePrice
        : a.sortOrder - b.sortOrder);

  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Products"
        title="Product & Color"
        onClose={onClose}
      />

      <div className="rot-product">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mockup.front} alt="" />
        <div>
          <p className="rot-product-name">{product.name}</p>
          {product.styleCode ? <p className="rot-muted">Style {product.styleCode}</p> : null}
          <p className="rot-product-color">
            <Swatch hex={mockup.hex} size={18} /> {mockup.name}
          </p>
        </div>
      </div>

      <h3 className="rot-sub">Color</h3>
      <div className="rot-swatchgrid">
        {mockups.map((m) => (
          <button
            key={m.code}
            type="button"
            className={`rot-garment${m.code === mockup.code ? " is-active" : ""}`}
            onClick={() => onColor(m.code)}
            aria-pressed={m.code === mockup.code}
            aria-label={m.name}
            data-color-slug={m.slug}
            title={m.name}
          >
            <span style={{ background: m.hex }} />
            <span className="rot-sr">{m.name}</span>
          </button>
        ))}
      </div>

      <h3 className="rot-sub">Switch blank</h3>
      <div className="rot-catalog-filters">
        <input className="rot-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or style" aria-label="Search products or style" />
        <div className="rot-catalog-filter-row">
          <select className="rot-input" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="rot-input" value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Filter by product type">
            <option value="all">All types</option>
            {kinds.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="rot-catalog-filter-row">
          <select className="rot-input" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Filter by available color">
            <option value="all">Any color</option>
            {colors.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="rot-input" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
            <option value="featured">Catalog order</option>
            <option value="name">Name</option>
            <option value="price">Lowest blank price</option>
          </select>
        </div>
      </div>
      <div className="rot-blanks" aria-live="polite">
        {visibleProducts.map((p) => (
          <Link
            key={p.id}
            href={`/customize/${p.slug}`}
            className={`rot-blank${p.id === product.id ? " is-active" : ""}`}
            aria-current={p.id === product.id ? "true" : undefined}
            onClick={(event) => {
              if (!onSwitchProduct(p)) event.preventDefault();
            }}
          >
            {p.id === product.id || p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.id === product.id ? mockup.front : p.images[0].url} alt="" />
            ) : (
              <Image src="/brand/kingdom-logo.png" alt="" width={40} height={24} />
            )}
            <span className="rot-blank-details">
              <strong>{p.name}</strong>
              <small>{p.styleCode} · {p.kind} · {p.colors.length} colors</small>
              <small>{sizeSummary(p.sizes) || p.sizes.map((size) => size.label).join(", ")}</small>
              <small>From {formatUSD(lowestPrintedUnit(p) ?? p.basePrice + p.printFeePerSide)} printed</small>
            </span>
          </Link>
        ))}
        {visibleProducts.length === 0 ? <p className="rot-phint">No products match those filters.</p> : null}
      </div>
    </div>
  );
}

export function ProductSwitchConfirmPanel({
  target,
  unavailableLines,
  rosterCount,
  onContinue,
  onCancel,
}: {
  target: Product;
  unavailableLines: { label: string; qty: number }[];
  rosterCount: number;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Product change"
        title="Unavailable sizes"
        hint={`${target.name} does not offer every size in your current order.`}
        onClose={onCancel}
      />
      <p className="rot-callout">
        Your artwork and compatible quantities will stay. Continuing removes the unavailable quantities and size assignments listed below.
      </p>
      <ul className="rot-review rot-switch-impact">
        {unavailableLines.length ? (
          <li>
            <span>Quantity to remove</span>
            <strong>{unavailableLines.map(({ label, qty }) => `${label} × ${qty}`).join(", ")}</strong>
          </li>
        ) : null}
        {rosterCount ? (
          <li>
            <span>Name/number assignments to remove</span>
            <strong>{rosterCount}</strong>
          </li>
        ) : null}
      </ul>
      <div className="rot-switch-actions">
        <button type="button" className="rot-cta rot-cta-ghost" onClick={onCancel}>Keep current product</button>
        <button type="button" className="rot-cta" onClick={onContinue}>Continue without unavailable sizes</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Clipart
   ------------------------------------------------------------------------- */

const TEXT_STYLES: { name: string; patch: Partial<TextLayer> }[] = [
  { name: "Classic", patch: { font: "oswald", uppercase: false } },
  { name: "Varsity", patch: { font: "archivo", color: "#ffffff", strokeColor: "#141414", strokeWidth: 8 } },
  { name: "Groovy", patch: { font: "lobster", uppercase: false } },
  { name: "Bold", patch: { font: "archivo" } },
  { name: "College", patch: { font: "serif", weight: 900 } },
  { name: "Elegant", patch: { font: "playfair", italic: true, uppercase: false } },
  { name: "Marker", patch: { font: "permanent-marker" } },
  { name: "Arc Up", patch: { font: "oswald", arc: 30, uppercase: false } },
  { name: "Distressed", patch: { font: "anton", distress: 2 } },
  { name: "Serif", patch: { font: "merriweather", uppercase: false } },
  { name: "Script", patch: { font: "pacifico", uppercase: false } },
  { name: "Modern", patch: { font: "montserrat" } },
];

export function AddTextPanel({ onAdd, onClose }: { onAdd: (patch: Partial<TextLayer>) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="rot-scroll">
      <PanelHeader eyebrow="Text" title="Add Text" onClose={onClose} />
      <textarea className="rot-textarea" aria-label="New text" placeholder="Enter text..." value={text} onChange={(event) => setText(event.target.value)} rows={3} />
      <button type="button" className="rot-cta" disabled={!text.trim()} onClick={() => onAdd({ text: text.trim() })}>+ Add text</button>
      <h3 className="rot-sub">Popular styles</h3>
      <div className="rot-text-presets">
        {TEXT_STYLES.map(({ name, patch }) => (
          <button type="button" key={name} onClick={() => onAdd({ ...patch, text: text.trim() || name })} aria-label={`Add ${name} text`}>
            <span style={{ fontFamily: svgFontStack(patch.font ?? "anton"), fontStyle: patch.italic ? "italic" : "normal", fontWeight: patch.weight ?? 700, WebkitTextStroke: patch.strokeWidth ? "1px #141414" : undefined, color: patch.strokeWidth ? "#fff" : undefined }}>{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ArtPanel({ onAdd, onClose }: { onAdd: (item: ArtItem) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(60);
  const lumise = useLumiseLibrary<ArtItem>("/lumise/cliparts.json");
  const categories = useMemo(
    () => ["All", ...new Set([...ART_CATEGORIES.filter((item) => item !== "All"), ...lumise.categories])],
    [lumise.categories],
  );
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...ART_LIBRARY, ...lumise.items].filter((item) =>
      (category === "All" || (item.category ?? "Symbols") === category)
      && (!normalizedQuery || `${item.name} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(normalizedQuery)),
    );
  }, [category, lumise.items, query]);
  const visibleResults = results.slice(0, visibleCount);
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Add Art"
        title="Clipart"
        onClose={onClose}
      />
      <input className="rot-art-search" type="search" aria-label="Search artwork" placeholder="Search 3,000+ graphics" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(60); }} />
      <select className="rot-art-category" aria-label="Artwork category" value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(60); }}>
        {categories.map((option) => <option key={option} value={option}>{option === "All" ? "All artwork" : option}</option>)}
      </select>
      {lumise.loading ? <p className="rot-library-status" role="status">Loading the full clipart library…</p> : null}
      {lumise.error ? <p className="rot-library-status is-error" role="status">The extended clipart library could not be loaded.</p> : null}
      {!lumise.loading && !results.length ? <p role="status">No artwork found.</p> : null}
      <ul className="rot-artgrid">
        {visibleResults.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onAdd(item)} title={item.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt="" />
              <span>{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {visibleCount < results.length ? (
        <button type="button" className="rot-library-more" onClick={() => setVisibleCount((count) => count + 60)}>
          Load more graphics · {results.length - visibleCount} remaining
        </button>
      ) : null}
    </div>
  );
}

export function LayersPanel({
  layers,
  selectedIds,
  multiSelect,
  canUngroup,
  onPick,
  onToggle,
  onMultiSelect,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onClose,
}: {
  layers: DesignLayer[];
  selectedIds: string[];
  multiSelect: boolean;
  canUngroup: boolean;
  onPick: (id: string) => void;
  onToggle: (id: string) => void;
  onMultiSelect: (on: boolean) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const chosen = selectedIds.length;
  // Top of the stack first, like every other design tool.
  const rows = [...layers].reverse();
  const groupNames = new Map<string, number>();
  for (const layer of layers) {
    if (layer.groupId && !groupNames.has(layer.groupId)) groupNames.set(layer.groupId, groupNames.size + 1);
  }

  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Layers"
        title="Elements"
        hint={chosen < 2 ? "Group two or more elements so they move as one." : `${chosen} elements selected.`}
        onClose={onClose}
      />

      <div className="rot-layerbar">
        <button
          type="button"
          role="switch"
          aria-checked={multiSelect}
          className={`rot-layerswitch${multiSelect ? " is-on" : ""}`}
          onClick={() => onMultiSelect(!multiSelect)}
        >
          <span className="rot-layerswitch-dot" aria-hidden="true" />
          <span>Select multiple</span>
        </button>
        <button type="button" className="rot-cta rot-layer-group" disabled={chosen < 2} onClick={onGroup}>
          <GroupIcon size={20} />
          <span>Group{chosen >= 2 ? ` ${chosen}` : ""}</span>
        </button>
      </div>

      {multiSelect ? (
        <p className="rot-layerhint" role="status">
          Tap elements on the shirt or tick them below, then press Group.
        </p>
      ) : null}

      {!rows.length ? <p role="status">Nothing on this side yet.</p> : null}

      <ul className="rot-layerlist" aria-label="Design elements">
        {rows.map((layer) => {
          const picked = selectedIds.includes(layer.id);
          const isText = layer.type === "text";
          const label = isText ? (layer.text.trim() || "Text") : layer.name || "Artwork";
          const groupNumber = layer.groupId ? groupNames.get(layer.groupId) : undefined;
          return (
            <li key={layer.id} className={`rot-layerrow${picked ? " is-on" : ""}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={picked}
                aria-label={`Add ${label} to the selection`}
                className="rot-layercheck"
                onClick={() => onToggle(layer.id)}
              >
                {picked ? <CheckGlyph size={16} /> : null}
              </button>
              <button
                type="button"
                className="rot-layerpick"
                aria-label={`Select ${label}`}
                onClick={() => onPick(layer.id)}
              >
                <span className="rot-layerthumb" aria-hidden="true">
                  {isText ? (
                    <span className="rot-layerthumb-text">T</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(layer as ImageLayer).src} alt="" />
                  )}
                </span>
                <span className="rot-layerlabel">
                  <strong>{isText && layer.uppercase ? label.toUpperCase() : label}</strong>
                  <small>
                    {isText ? "Text" : "Artwork"}
                    {groupNumber ? ` · Group ${groupNumber}` : ""}
                    {layer.locked ? " · Locked" : ""}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rot-layeractions">
        <button
          type="button"
          className="rot-cta rot-cta-ghost"
          disabled={!canUngroup}
          onClick={onUngroup}
        >
          <UngroupIcon size={18} />
          <span>Ungroup</span>
        </button>
        <button type="button" className="rot-cta rot-cta-ghost" disabled={!chosen} onClick={onDuplicate}>
          <DuplicateIcon size={18} />
          <span>Duplicate</span>
        </button>
        <button
          type="button"
          className="rot-cta rot-cta-ghost rot-layer-delete"
          disabled={!chosen}
          onClick={onDelete}
        >
          <TrashIcon size={18} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

export function TemplatesPanel({ onAdd, onClose }: { onAdd: (template: DesignTemplate) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(40);
  const lumise = useLumiseLibrary<DesignTemplate>("/lumise/templates.json");
  const normalizedQuery = query.trim().toLowerCase();
  const categories = useMemo(
    () => ["All", ...new Set([...TEMPLATE_CATEGORIES.filter((item) => item !== "All"), ...lumise.categories])],
    [lumise.categories],
  );
  const results = useMemo(
    () => [...DESIGN_TEMPLATES, ...lumise.items].filter((item) =>
      (category === "All" || item.category === category)
      && (!normalizedQuery || `${item.name} ${item.category} ${item.subtitle} ${item.tags.join(" ")}`.toLowerCase().includes(normalizedQuery)),
    ),
    [category, lumise.items, normalizedQuery],
  );
  const visibleResults = results.slice(0, visibleCount);

  return (
    <div className="rot-scroll">
      <PanelHeader eyebrow="Design Library" title="Templates" onClose={onClose} />
      <input className="rot-art-search" type="search" aria-label="Search templates" placeholder="Search 300+ templates" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(40); }} />
      <select className="rot-art-category" aria-label="Template category" value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(40); }}>
        {categories.map((option) => <option key={option} value={option}>{option === "All" ? "All categories" : option}</option>)}
      </select>
      {lumise.loading ? <p className="rot-library-status" role="status">Loading the full template library…</p> : null}
      {lumise.error ? <p className="rot-library-status is-error" role="status">The extended template library could not be loaded.</p> : null}
      {!lumise.loading && !results.length ? <p role="status">No templates found.</p> : null}
      <ul className="rot-template-grid">
        {visibleResults.map((item) => {
          const previewArt = item.artId ? ART_LIBRARY.find((artItem) => artItem.id === item.artId) : undefined;
          const previewText = (item.elements ?? []).filter((element) => element.type === "text").map((element) => element.layer);
          const [headline, tagline] = previewText;
          return (
            <li key={item.id}>
              <button type="button" className="rot-template-card" onClick={() => onAdd(item)} aria-label={`Use ${item.name} template`}>
                <span className="rot-template-preview" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.previewSrc ? <img className="is-full" src={item.previewSrc} alt="" /> : previewArt ? <img src={previewArt.src} alt="" /> : null}
                  {!item.previewSrc && headline ? <strong style={{ fontFamily: svgFontStack(headline.font), color: headline.color }}>{headline.text}</strong> : null}
                  {!item.previewSrc && tagline ? <small>{tagline.text}</small> : null}
                  <span className="rot-template-free">FREE</span>
                </span>
                <span className="rot-template-info"><strong>{item.name}</strong><small>{item.category}</small></span>
              </button>
            </li>
          );
        })}
      </ul>
      {visibleCount < results.length ? (
        <button type="button" className="rot-library-more" onClick={() => setVisibleCount((count) => count + 40)}>
          Load more templates · {results.length - visibleCount} remaining
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Local text-layout assistant
   ------------------------------------------------------------------------- */

function conceptFromPrompt(prompt: string): {
  title: string;
  subtitle: string;
  ink: string;
  accent: string;
  font: string;
  arc: number;
  summary: string;
} {
  const value = prompt.trim();
  const lower = value.toLowerCase();
  const quoted = value.match(/[“"]([^”"]+)[”"]/);
  const afterFor = value.match(/\bfor\s+(.+)$/i)?.[1];
  const rawTitle = quoted?.[1] ?? afterFor ?? value;
  const title = rawTitle
    .replace(/\b(create|design|make|a|an|shirt|t-shirt|tee|logo)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28)
    .toUpperCase() || "YOUR TEAM";

  const vintage = /vintage|retro|old school|classic/.test(lower);
  const minimal = /minimal|simple|clean/.test(lower);
  const faith = /faith|church|christian|bible/.test(lower);
  const ink = faith ? "#F7F1DE" : vintage ? "#F4C95D" : minimal ? "#141414" : "#FFFFFF";
  const accent = faith ? "#D6A84F" : vintage ? "#8E3B2E" : lower.includes("basket") ? "#F47B20" : "#E11D48";
  const font = vintage ? "bebas" : minimal ? "montserrat" : "anton";
  const arc = vintage ? -12 : lower.includes("sport") || lower.includes("team") ? 8 : 0;
  const subtitle = afterFor && afterFor.toUpperCase() !== title ? afterFor.slice(0, 22).toUpperCase() : "CUSTOM APPAREL";
  const styleName = vintage ? "vintage" : minimal ? "minimal" : faith ? "faith" : "bold";

  return {
    title,
    subtitle,
    ink,
    accent,
    font,
    arc,
    summary: `${styleName} ${title.toLowerCase()} lettering`,
  };
}

export function TextIdeasPanel({
  side,
  onAdd,
  onClose,
}: {
  side: GarmentSide;
  onAdd: (layers: TextLayer[], summary: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = () => {
    setBusy(true);
    const concept = conceptFromPrompt(prompt);
    const headline: TextLayer = newTextLayer({
      text: concept.title,
      font: concept.font,
      color: concept.ink,
      strokeColor: concept.accent,
      strokeWidth: concept.ink === "#141414" ? 0 : 1.5,
      fontSize: 15,
      y: 37,
      arc: concept.arc,
      weight: 900,
    });
    const subline: TextLayer = newTextLayer({
      text: concept.subtitle,
      font: "montserrat",
      color: concept.accent,
      fontSize: 4.2,
      y: 63,
      weight: 700,
      letterSpacing: 7,
    });
    onAdd([headline, subline], concept.summary);
    setBusy(false);
  };

  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Text ideas"
        title="Create your lettering"
        onClose={onClose}
      />
      <div className="rot-ideas-panel">
        <label htmlFor="text-ideas-prompt">Describe the lettering for the {side}.</label>
        <textarea
          id="text-ideas-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder='“Kings United” basketball team, bold retro style'
          rows={4}
        />
        <button type="button" className="rot-cta" onClick={generate} disabled={busy || !prompt.trim()}>
          <CheckGlyph size={18} /> {busy ? "Creating…" : "Add lettering"}
        </button>
        <p className="rot-ideas-examples">Try a team, event, or brand phrase with a style such as retro or minimal.</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Names & numbers
   ------------------------------------------------------------------------- */

export type NNSize = "small" | "medium" | "large";

export interface NNSettings {
  names: boolean;
  numbers: boolean;
  subtitles: boolean;
  side: GarmentSide;
  size: NNSize;
  font: string;
  color: string;
}

export const NN_DEFAULTS: NNSettings = {
  names: false,
  numbers: false,
  subtitles: false,
  side: "back",
  size: "large",
  font: "archivo",
  color: "#141414",
};

export function NamesIntro({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  const shirts = [
    { code: "WHT", name: "JAMESON", num: "21", ink: "#B0183A" },
    { code: "SPGY", name: "THOMAS", num: "13", ink: "#141414" },
    { code: "LB", name: "THOMAS", num: "26", ink: "#141414" },
  ];
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Names & Numbers"
        title="Add Names & Numbers"
        hint="Use personalized Names & Numbers for projects like team jerseys where you need a unique name and/or number for each item."
        onClose={onClose}
      />
      <div className="rot-hero" aria-hidden="true">
        {shirts.map((s) => {
          const m = TEE_MOCKUPS.find((t) => t.code === s.code) ?? TEE_MOCKUPS[0];
          return (
            <div key={s.code} className="rot-hero-shirt" style={{ backgroundImage: `url(${m.back})` }}>
              <b style={{ color: s.ink, fontFamily: svgFontStack("archivo") }}>{s.name}</b>
              <b className="rot-hero-num" style={{ color: s.ink, fontFamily: svgFontStack("archivo") }}>
                {s.num}
              </b>
            </div>
          );
        })}
      </div>
      <button type="button" className="rot-cta" onClick={onStart}>
        Add Names & Numbers
      </button>
    </div>
  );
}

const SIZE_LABEL: Record<NNSize, string> = { small: "Small", medium: "Medium", large: "Large" };

function Select({
  label,
  value,
  options,
  onChange,
  disabled,
  fontOf,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  fontOf?: (v: string) => string | undefined;
}) {
  return (
    <div className="rot-row">
      <span className="rot-row-label">{label}</span>
      <span className={`rot-pillselect${disabled ? " is-disabled" : ""}`}>
        <select
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          style={fontOf ? { fontFamily: fontOf(value) } : undefined}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

export function NamesTools({
  settings,
  onChange,
  onEnter,
  onRemove,
  hasExisting,
  onClose,
}: {
  settings: NNSettings;
  onChange: (patch: Partial<NNSettings>) => void;
  onEnter: () => void;
  onRemove: () => void;
  hasExisting: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<"main" | "color">("main");
  const any = settings.names || settings.numbers;
  const off = !any;

  if (view === "color") {
    return (
      <div className="rot-scroll">
        <ColorView
          title="Name & Number Color"
          value={settings.color}
          onPick={(hex) => {
            if (hex) onChange({ color: hex });
            setView("main");
          }}
          onBack={() => setView("main")}
        />
      </div>
    );
  }

  return (
    <div className="rot-scroll">
      <PanelHeader eyebrow="Names & Numbers" title="Names & Numbers Tools" onClose={onClose} />

      <div className="rot-row rot-stepone">
        <span className="rot-row-label">Step 1</span>
        <div className="rot-checks">
          <div className="rot-checkcol">
            <label className="rot-check">
              <input
                type="checkbox"
                checked={settings.names}
                onChange={(e) =>
                  onChange({ names: e.target.checked, subtitles: e.target.checked ? settings.subtitles : false })
                }
              />
              <span>Add Names</span>
            </label>
            <label className={`rot-check${settings.names ? "" : " is-disabled"}`}>
              <input
                type="checkbox"
                disabled={!settings.names}
                checked={settings.subtitles}
                onChange={(e) => onChange({ subtitles: e.target.checked })}
              />
              <span>Add Subtitles</span>
            </label>
          </div>
          <label className="rot-check">
            <input
              type="checkbox"
              checked={settings.numbers}
              onChange={(e) => onChange({ numbers: e.target.checked })}
            />
            <span>Add Numbers</span>
          </label>
        </div>
      </div>

      <Select
        label="Side"
        value={settings.side}
        disabled={off}
        options={[
          { value: "back", label: "BACK" },
          { value: "front", label: "FRONT" },
        ]}
        onChange={(v) => onChange({ side: v as GarmentSide })}
      />
      <Select
        label="Size"
        value={settings.size}
        disabled={off}
        options={(Object.keys(SIZE_LABEL) as NNSize[]).map((k) => ({
          value: k,
          label: SIZE_LABEL[k].toUpperCase(),
        }))}
        onChange={(v) => onChange({ size: v as NNSize })}
      />
      <Select
        label="Font"
        value={settings.font}
        disabled={off}
        options={FONTS.filter((f) => (f.scripts ?? ["latin"]).includes("latin")).map((f) => ({
          value: f.value,
          label: f.label.toUpperCase(),
        }))}
        fontOf={svgFontStack}
        onChange={(v) => onChange({ font: v })}
      />
      <div className={`rot-row${off ? " is-disabled" : ""}`}>
        <span className="rot-row-label">Color</span>
        <button
          type="button"
          className="rot-row-value rot-plainbtn"
          disabled={off}
          onClick={() => setView("color")}
        >
          <strong>{inkName(settings.color)}</strong>
          <Swatch hex={settings.color} />
        </button>
      </div>

      <button type="button" className="rot-cta" disabled={off} onClick={onEnter}>
        {hasExisting ? "Edit Names/Numbers" : "Enter Names/Numbers"}
      </button>
      {hasExisting ? (
        <button type="button" className="rot-textlink is-danger" onClick={onRemove}>
          Remove names & numbers
        </button>
      ) : null}

      <div className="rot-pricenote">
        <p>Complete list required for accurate pricing</p>
        <p>
          Names = {formatUSD(PERSONALIZATION_FEE.names)} | Numbers = {formatUSD(PERSONALIZATION_FEE.numbers)}
        </p>
        <p>Names & Numbers = {formatUSD(PERSONALIZATION_FEE.both)}</p>
      </div>
    </div>
  );
}

export function RosterEditor({
  settings,
  roster,
  sizes,
  onUpdate,
  onAdd,
  onRemove,
  onDone,
  onBack,
}: {
  settings: NNSettings;
  roster: RosterEntry[];
  sizes: string[];
  onUpdate: (id: string, patch: Partial<RosterEntry>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <div className="rot-editor">
      <div className="rot-editor-scroll">
        <PanelHeader
          eyebrow="Names & Numbers"
          title="Enter Names & Numbers"
          hint="One row per shirt. The size of each row sets your size run."
          onBack={onBack}
        />
        <ul className="rot-roster">
          {roster.map((entry, i) => (
            <li key={entry.id} className="rot-roster-row">
              <span className="rot-roster-n">{i + 1}</span>
              <select
                className="rot-input"
                aria-label={`Size for shirt ${i + 1}`}
                value={entry.size ?? sizes[0]}
                onChange={(e) => onUpdate(entry.id, { size: e.target.value })}
              >
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {settings.names ? (
                <input
                  className="rot-input"
                  placeholder="Name"
                  aria-label={`Name for shirt ${i + 1}`}
                  maxLength={20}
                  value={entry.name}
                  onChange={(e) => onUpdate(entry.id, { name: e.target.value })}
                />
              ) : null}
              {settings.numbers ? (
                <input
                  className="rot-input rot-input-num"
                  placeholder="#"
                  inputMode="numeric"
                  aria-label={`Number for shirt ${i + 1}`}
                  maxLength={3}
                  value={entry.number}
                  onChange={(e) => onUpdate(entry.id, { number: e.target.value.replace(/\D/g, "") })}
                />
              ) : null}
              {settings.subtitles ? (
                <input
                  className="rot-input rot-input-sub"
                  placeholder="Subtitle"
                  aria-label={`Subtitle for shirt ${i + 1}`}
                  maxLength={24}
                  value={entry.subtitle ?? ""}
                  onChange={(e) => onUpdate(entry.id, { subtitle: e.target.value })}
                />
              ) : null}
              <button
                type="button"
                className="rot-iconbtn"
                onClick={() => onRemove(entry.id)}
                aria-label={`Remove shirt ${i + 1}`}
                disabled={roster.length <= 1}
              >
                <TrashIcon size={20} />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="rot-textlink" onClick={onAdd}>
          + Add another shirt
        </button>
      </div>
      <div className="rot-footbar">
        <button type="button" className="rot-cta" onClick={onDone}>
          Done · {roster.length} {roster.length === 1 ? "shirt" : "shirts"}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Distress
   ------------------------------------------------------------------------- */

const DISTRESS_LEVELS = [
  { level: 0, label: "None" },
  { level: 1, label: "Light" },
  { level: 2, label: "Medium" },
  { level: 3, label: "Heavy" },
];

export function DistressPanel({
  level,
  hasLayers,
  side,
  onPick,
  onClose,
}: {
  level: number;
  hasLayers: boolean;
  side: GarmentSide;
  onPick: (level: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Distress"
        title="Distress Your Design"
        hint={`Give the ${side} a worn, vintage print by knocking small flecks out of the ink.`}
        onClose={onClose}
      />
      <div className="rot-distress" role="radiogroup" aria-label="Distress level">
        {DISTRESS_LEVELS.map((d) => (
          <button
            key={d.level}
            type="button"
            role="radio"
            aria-checked={level === d.level}
            className={`rot-distress-opt${level === d.level ? " is-active" : ""}`}
            disabled={!hasLayers}
            onClick={() => onPick(d.level)}
          >
            <span className={`rot-distress-thumb is-${d.level}`} />
            <span>{d.label}</span>
          </button>
        ))}
      </div>
      {!hasLayers ? (
        <p className="rot-phint">Add text or artwork to the {side} first, then distress it.</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Saved designs
   ------------------------------------------------------------------------- */

export function SavedPanel({
  drafts,
  onSave,
  onLoad,
  onDelete,
  onClose,
}: {
  drafts: SavedDraft[];
  onSave: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Saved"
        title="Your Saved Designs"
        hint="Designs are saved on this device so you can pick up where you left off."
        onClose={onClose}
      />
      <button type="button" className="rot-cta" onClick={onSave}>
        Save current design
      </button>
      {drafts.length === 0 ? (
        <p className="rot-phint">Nothing saved yet.</p>
      ) : (
        <ul className="rot-drafts">
          {drafts.map((d) => (
            <li key={d.id}>
              <button type="button" className="rot-draft" onClick={() => onLoad(d.id)}>
                <Swatch hex={d.colorHex} size={26} />
                <span>
                  <strong>{d.productName}</strong>
                  <small>
                    {d.colorName} · {new Date(d.savedAt).toLocaleDateString()}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className="rot-iconbtn"
                onClick={() => onDelete(d.id)}
                aria-label={`Delete saved ${d.productName} design`}
              >
                <TrashIcon size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Quantity + review
   ------------------------------------------------------------------------- */

export function QuantityPanel({
  product,
  lines,
  quantity,
  quote,
  rosterLocked,
  onQty,
  onFill,
  onEditRoster,
}: {
  product: Product;
  lines: Record<string, number>;
  quantity: number;
  quote: PriceQuote;
  rosterLocked: boolean;
  onQty: (label: string, value: number) => void;
  onFill: (label: string) => void;
  onEditRoster: () => void;
}) {
  const groups = splitSizeGroups(product.sizes);
  const sizeGroups = [
    { key: "adult", title: "Adult Sizes", sizes: groups.adult },
    { key: "youth", title: "Youth Sizes", sizes: groups.youth },
  ].filter((group) => group.sizes.length > 0);

  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Step 2"
        title="Quantity & Sizes"
        hint="Enter how many of each size you need. The price drops as your order crosses a quantity break."
      />
      {rosterLocked ? (
        <p className="rot-callout">
          Your names & numbers list sets the size run.{" "}
          <button type="button" className="rot-inline" onClick={onEditRoster}>
            Edit the list
          </button>
        </p>
      ) : null}
      {sizeGroups.map((group) => (
        <section className="rot-size-group" key={group.key} aria-labelledby={`size-group-${group.key}`}>
          <h3 className="rot-size-group-title" id={`size-group-${group.key}`}>
            {group.title}
          </h3>
          <div className="rot-sizes">
            {group.sizes.map((s) => {
              const qty = lines[s.label] ?? 0;
              const display = sizeDisplayLabel(s.label);
              return (
                <div key={s.label} className={`rot-size${qty > 0 ? " has-qty" : ""}`}>
                  <label htmlFor={`q-${s.label}`}>
                    {display}
                    {s.surcharge > 0 ? <small>+{formatUSD(s.surcharge)}</small> : null}
                  </label>
                  <div className="rot-stepper">
                    <button
                      type="button"
                      onClick={() => onQty(s.label, qty - 1)}
                      disabled={qty <= 0 || rosterLocked}
                      aria-label={`Decrease ${group.title.replace(" Sizes", "")} ${display}`}
                    >
                      <MinusGlyph size={18} />
                    </button>
                    <input
                      id={`q-${s.label}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999}
                      value={qty}
                      disabled={rosterLocked}
                      onChange={(e) => onQty(s.label, Number(e.target.value))}
                      aria-label={`${group.title.replace(" Sizes", "")} ${display} quantity`}
                    />
                    <button
                      type="button"
                      onClick={() => onQty(s.label, qty + 1)}
                      disabled={rosterLocked}
                      aria-label={`Increase ${group.title.replace(" Sizes", "")} ${display}`}
                    >
                      <PlusGlyph size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!rosterLocked ? (
        <div className="rot-quick">
          <span>Put all {quantity || 1} in one size:</span>
          {["XS", "S", "M", "L", "XL", "2XL", "3XL"]
            .filter((l) => product.sizes.some((s) => s.label === l))
            .map((l) => (
              <button key={l} type="button" onClick={() => onFill(l)}>
                All {l}
              </button>
            ))}
        </div>
      ) : null}

      <dl className="rot-totals">
        <div>
          <dt>Shirts</dt>
          <dd>{quantity}</dd>
        </div>
        <div>
          <dt>Base each</dt>
          <dd>{formatUSD(quote.unitBase)}</dd>
        </div>
        {quote.surchargeTotal > 0 ? (
          <div>
            <dt>Size surcharges</dt>
            <dd>{formatUSD(quote.surchargeTotal)}</dd>
          </div>
        ) : null}
        <div className="is-total">
          <dt>Subtotal</dt>
          <dd>{formatUSD(quote.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ReviewPanel({
  product,
  mockup,
  sidesLabel,
  elements,
  quantity,
  quote,
  lines,
  roster,
  previews,
  designNotes,
  onDesignNotes,
  rows,
}: {
  product: Product;
  mockup: TeeMockup;
  sidesLabel: string;
  elements: number;
  quantity: number;
  quote: PriceQuote;
  lines: { label: string; qty: number }[];
  roster: number;
  previews: { front: string | null; back: string | null };
    designNotes: string;
    onDesignNotes: (value: string) => void;
  rows?: ReactNode;
}) {
  const item = (label: string, value: ReactNode) => (
    <li>
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Step 3"
        title="Review Your Order"
        hint="Check your design and size run, then add it to your cart."
      />
      <div className="rot-previews">
        {(
          [
            ["Front", previews.front ?? mockup.front],
            ["Back", previews.back ?? mockup.back],
          ] as const
        ).map(([label, src]) => (
          <figure key={label}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${label} of your design`} />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
      <ul className="rot-review">
        {item("Blank", `${product.name}${product.styleCode ? ` · ${product.styleCode}` : ""}`)}
        {item(
          "Color",
          <>
            <Swatch hex={mockup.hex} size={16} /> {mockup.name}
          </>
        )}
        {item("Printed sides", sidesLabel)}
        {item("Elements", elements || "None")}
        {item(
          "Size quantities",
          lines.filter((line) => line.qty > 0).map((line) => {
            const surcharge = product.sizes.find((size) => size.label === line.label)?.surcharge ?? 0;
            return `${line.label} × ${line.qty} at ${formatUSD(quote.unitBase + surcharge)} each`;
          }).join(", ") || "None"
        )}
        {roster ? item("Names & numbers", `${roster} shirts`) : null}
        {item("Shirts", quantity)}
        {item("Average price each", quantity ? formatUSD(quote.total / quantity) : formatUSD(quote.unitBase))}
        <li className="is-total">
          <span>Subtotal</span>
          <strong>{formatUSD(quote.total)}</strong>
        </li>
      </ul>
        <label className="rot-design-notes">
          Design notes (optional)
          <textarea value={designNotes} onChange={(event) => onDesignNotes(event.target.value)} maxLength={2000} rows={3} placeholder="Placement, ink color, or production instructions" />
        </label>
      {rows}
    </div>
  );
}
