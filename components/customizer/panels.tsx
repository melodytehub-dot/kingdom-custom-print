"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { DesignLayer, GarmentSide, Product, RosterEntry, TextLayer } from "@/lib/types";
import { newImageLayer, newTextLayer } from "@/lib/design";
import type { SavedDraft } from "@/lib/design";
import { PERSONALIZATION_FEE, formatUSD, type PriceQuote } from "@/lib/pricing";
import { TEE_MOCKUPS, type TeeMockup } from "@/lib/mockups";
import { FONTS, svgFontStack } from "@/lib/fonts";
import { ART_LIBRARY, type ArtItem } from "./art";
import {
  ColorView,
  PanelHeader,
  Row,
  Swatch,
  inkName,
} from "./editors";
import { CheckGlyph, MinusGlyph, PlusGlyph, TrashIcon } from "./icons";
import { useState } from "react";

/* -------------------------------------------------------------------------
   Products
   ------------------------------------------------------------------------- */

export function ProductsPanel({
  product,
  products,
  mockup,
  onColor,
  onClose,
}: {
  product: Product;
  products: Product[];
  mockup: TeeMockup;
  onColor: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Products"
        title="Product & Color"
        hint="Pick the shirt, then a colour. The preview swaps to that exact garment."
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
        {TEE_MOCKUPS.map((m) => (
          <button
            key={m.code}
            type="button"
            className={`rot-garment${m.code === mockup.code ? " is-active" : ""}`}
            onClick={() => onColor(m.code)}
            aria-pressed={m.code === mockup.code}
            title={m.name}
          >
            <span style={{ background: m.hex }} />
            <span className="rot-sr">{m.name}</span>
          </button>
        ))}
      </div>

      <h3 className="rot-sub">Switch blank</h3>
      <div className="rot-blanks">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/customize/${p.slug}`}
            className={`rot-blank${p.id === product.id ? " is-active" : ""}`}
            aria-current={p.id === product.id ? "true" : undefined}
          >
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0].url} alt="" />
            ) : (
              <Image src="/brand/kingdom-logo.png" alt="" width={40} height={24} />
            )}
            <span>{p.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Clipart
   ------------------------------------------------------------------------- */

export function ArtPanel({ onAdd, onClose }: { onAdd: (item: ArtItem) => void; onClose: () => void }) {
  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Add Art"
        title="Clipart"
        hint="Tap a graphic to drop it on your shirt, then resize, rotate, recolour and flip it."
        onClose={onClose}
      />
      <ul className="rot-artgrid">
        {ART_LIBRARY.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onAdd(item)} title={item.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt="" />
              <span>{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Free AI design assistant
   ------------------------------------------------------------------------- */

function conceptFromPrompt(prompt: string): {
  title: string;
  subtitle: string;
  ink: string;
  accent: string;
  font: string;
  art: ArtItem;
  arc: number;
  summary: string;
} {
  const value = prompt.trim();
  const lower = value.toLowerCase();
  const art =
    lower.includes("basket") || lower.includes("sport") || lower.includes("team")
      ? ART_LIBRARY.find((item) => item.id === "burst")!
      : lower.includes("music") || lower.includes("concert")
        ? ART_LIBRARY.find((item) => item.id === "bolt")!
        : lower.includes("heart") || lower.includes("love")
          ? ART_LIBRARY.find((item) => item.id === "heart")!
          : lower.includes("faith") || lower.includes("church")
            ? ART_LIBRARY.find((item) => item.id === "cross")!
            : lower.includes("crown") || lower.includes("king")
              ? ART_LIBRARY.find((item) => item.id === "crown")!
              : ART_LIBRARY.find((item) => item.id === "star")!;

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
    art,
    arc,
    summary: `${styleName} ${art.name.toLowerCase()} concept with ${title.toLowerCase()} lettering`,
  };
}

export function AiDesignPanel({
  side,
  onGenerate,
  onClose,
}: {
  side: GarmentSide;
  onGenerate: (layers: DesignLayer[], summary: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const generate = () => {
    setBusy(true);
    // Keep the first version completely local: no API key, upload, or request.
    // The same callback can later be backed by an in-browser WebGPU model.
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
    const graphic = newImageLayer(concept.art.src, concept.art.name, 1, {
      x: 50,
      y: 50,
      scaleX: 0.34,
      scaleY: 0.34,
      opacity: 0.92,
    });
    onGenerate([graphic, headline, subline], concept.summary);
    setBusy(false);
  };

  return (
    <div className="rot-scroll">
      <PanelHeader
        eyebrow="Free AI assistant"
        title="Generate a concept"
        hint="Describe a team, event or brand. This browser-local assistant creates editable text and art layers without an API key."
        onClose={onClose}
      />
      <div className="rot-ai-panel">
        <label htmlFor="ai-design-prompt">What should go on the {side}?</label>
        <textarea
          id="ai-design-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder='“Kings United” basketball team, bold retro style'
          rows={4}
        />
        <button type="button" className="rot-cta" onClick={generate} disabled={busy}>
          <CheckGlyph size={18} /> {busy ? "Creating…" : "Generate editable design"}
        </button>
        <p className="rot-phint">Nothing is uploaded or sent anywhere. Every generated layer can be edited after it is added.</p>
        <p className="rot-ai-examples">Try: “church youth retreat”, “summer concert”, or “minimal coffee brand”.</p>
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
      <div className="rot-sizes">
        {product.sizes.map((s) => {
          const qty = lines[s.label] ?? 0;
          return (
            <div key={s.label} className={`rot-size${qty > 0 ? " has-qty" : ""}`}>
              <label htmlFor={`q-${s.label}`}>
                {s.label}
                {s.surcharge > 0 ? <small>+{formatUSD(s.surcharge)}</small> : null}
              </label>
              <div className="rot-stepper">
                <button
                  type="button"
                  onClick={() => onQty(s.label, qty - 1)}
                  disabled={qty <= 0 || rosterLocked}
                  aria-label={`Decrease ${s.label}`}
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
                  aria-label={`${s.label} quantity`}
                />
                <button
                  type="button"
                  onClick={() => onQty(s.label, qty + 1)}
                  disabled={rosterLocked}
                  aria-label={`Increase ${s.label}`}
                >
                  <PlusGlyph size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
          <dt>Price each</dt>
          <dd>{formatUSD(quote.unitBase)}</dd>
        </div>
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
  roster,
  previews,
  rows,
}: {
  product: Product;
  mockup: TeeMockup;
  sidesLabel: string;
  elements: number;
  quantity: number;
  quote: PriceQuote;
  roster: number;
  previews: { front: string | null; back: string | null };
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
        {item("Blank", product.name)}
        {item(
          "Color",
          <>
            <Swatch hex={mockup.hex} size={16} /> {mockup.name}
          </>
        )}
        {item("Printed sides", sidesLabel)}
        {item("Elements", elements || "None")}
        {roster ? item("Names & numbers", `${roster} shirts`) : null}
        {item("Shirts", quantity)}
        {item("Price each", formatUSD(quote.unitBase))}
        <li className="is-total">
          <span>Subtotal</span>
          <strong>{formatUSD(quote.total)}</strong>
        </li>
      </ul>
      {rows}
    </div>
  );
}
