/**
 * Schema for pages built in the dashboard's visual editor.
 *
 * A page is a tree of sections, columns and widgets. Every field here is plain
 * data: the renderer turns it into React elements plus one generated
 * stylesheet, so a page can never carry markup, scripts or arbitrary CSS.
 *
 * Rules for changing this file:
 *  - Parsing is strict. An unknown or out-of-range value rejects the node, so a
 *    bad save cannot quietly drop half of an owner's styling.
 *  - Never widen a limit without checking the renderer and the QA harnesses.
 *  - Old layouts must keep parsing and rendering unchanged.
 */

import { RESERVED_PAGE_SLUGS } from "@/lib/custom-pages";

export const EDITABLE_STORE_SLUGS = [
  "about",
  "faq",
  "shipping",
  "contact",
  "privacy",
  "terms",
] as const;

export type EditableStoreSlug = (typeof EDITABLE_STORE_SLUGS)[number];

export const BUILDER_LIMITS = {
  sections: 24,
  columns: 4,
  widgets: 24,
  nodes: 400,
  heading: 200,
  subheading: 350,
  text: 4000,
  body: 600,
  alt: 160,
  button: 80,
  link: 300,
  eyebrow: 80,
  faqItems: 12,
  question: 160,
  answer: 900,
  stripItems: 8,
  featureItems: 8,
  galleryItems: 12,
  badge: 20,
  cardTitle: 120,
  cardBody: 500,
  label: 60,
  caption: 100,
  title: 100,
  description: 300,
  slug: 60,
} as const;

export const BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

export const BREAKPOINT_LABELS: Record<Breakpoint, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export type TextAlign = "left" | "center" | "right";
export type ObjectFit = "cover" | "contain";
export type VerticalAlign = "start" | "center" | "end";
export type BoxShadow = "none" | "sm" | "md" | "lg";
export type FontFamilyChoice = "body" | "display";
export type TextTransformChoice = "none" | "uppercase";

/**
 * Visual settings for one element. Everything is optional, so an element only
 * carries the properties the owner actually set.
 */
export type ElementStyle = {
  columnWidth?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: FontFamilyChoice;
  textTransform?: TextTransformChoice;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: TextAlign;
  textColor?: string;
  backgroundColor?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  marginTop?: number;
  marginBottom?: number;
  maxWidth?: number;
  minHeight?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  boxShadow?: BoxShadow;
  gap?: number;
  verticalAlign?: VerticalAlign;
  objectFit?: ObjectFit;
  aspectRatio?: number;
};

/** Desktop values plus the overrides for the narrower screens. */
export type StyleSet = {
  desktop: ElementStyle;
  tablet?: ElementStyle;
  mobile?: ElementStyle;
};

export type WidgetKind =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "spacer"
  | "divider"
  | "faq"
  | "promo-banner"
  | "product-grid"
  | "category-strip"
  | "feature-cards"
  | "image-gallery"
  | "contact-block";

type NodeBase = { id: string; style: StyleSet };

export type FaqItem = { question: string; answer: string };
export type CategoryStripItem = { label: string; href: string; imageSrc: string };
export type FeatureCardItem = { badge: string; title: string; body: string };
export type GalleryImageItem = { src: string; alt: string; caption: string; href: string };

export type ProductGridKindFilter =
  | ""
  | "tee"
  | "polo"
  | "longsleeve"
  | "hoodie"
  | "crew"
  | "cap"
  | "mug"
  | "tote"
  | "fleece";

export type WidgetNode = NodeBase &
  (
    | { kind: "heading"; text: string; level: 1 | 2 | 3 }
    | { kind: "text"; text: string }
    | { kind: "image"; src: string; alt: string; href: string }
    | { kind: "button"; text: string; href: string; variant: "solid" | "outline" }
    | { kind: "spacer"; height: number }
    | { kind: "divider" }
    | { kind: "faq"; items: FaqItem[] }
    | {
        kind: "promo-banner";
        eyebrow: string;
        heading: string;
        body: string;
        ctaText: string;
        ctaHref: string;
        secondaryCtaText: string;
        secondaryCtaHref: string;
        imageSrc: string;
        imageAlt: string;
        overlay: number;
        minHeight: number;
        align: "left" | "center";
        theme: "dark" | "light";
      }
    | {
        kind: "product-grid";
        heading: string;
        subheading: string;
        categorySlug: string;
        kindFilter: ProductGridKindFilter;
        featuredOnly: boolean;
        limit: number;
        columns: 2 | 3 | 4;
        ctaText: string;
        ctaHref: string;
      }
    | { kind: "category-strip"; heading: string; items: CategoryStripItem[] }
    | {
        kind: "feature-cards";
        heading: string;
        subheading: string;
        columns: 2 | 3 | 4;
        variant: "steps" | "cards";
        items: FeatureCardItem[];
      }
    | {
        kind: "image-gallery";
        heading: string;
        columns: 2 | 3 | 4;
        aspectRatio: number;
        items: GalleryImageItem[];
      }
    | {
        kind: "contact-block";
        heading: string;
        body: string;
        showDetails: boolean;
        showQuickLinks: boolean;
      }
  );

export type ColumnNode = NodeBase & {
  kind: "column";
  widgets: WidgetNode[];
  backgroundImage?: string;
  backgroundOverlay?: number;
};

/** `boxed` keeps the row inside the store's content width; off is full-bleed. */
export type SectionNode = NodeBase & {
  kind: "section";
  boxed: boolean;
  columns: ColumnNode[];
  backgroundImage?: string;
  backgroundOverlay?: number;
};

export type BuilderNode = SectionNode | ColumnNode | WidgetNode;
export type BuilderLayout = { version: 1; sections: SectionNode[] };

export type BuilderPage = {
  slug: string;
  title: string;
  description: string;
  showTitle: boolean;
  layout: BuilderLayout;
  updatedAt: string;
};

export const WIDGET_LABELS: Record<WidgetKind, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  spacer: "Spacer",
  divider: "Divider",
  faq: "Questions and answers",
  "promo-banner": "Hero / promo banner",
  "product-grid": "Product grid",
  "category-strip": "Category strip",
  "feature-cards": "Steps & feature cards",
  "image-gallery": "Photo gallery",
  "contact-block": "Contact form",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type NumberRange = readonly [min: number, max: number];

const NUMBER_RANGES = {
  columnWidth: [10, 100],
  fontSize: [10, 96],
  fontWeight: [300, 900],
  lineHeight: [0.9, 3],
  letterSpacing: [-2, 12],
  paddingTop: [0, 160],
  paddingRight: [0, 160],
  paddingBottom: [0, 160],
  paddingLeft: [0, 160],
  marginTop: [0, 160],
  marginBottom: [0, 160],
  maxWidth: [0, 1600],
  minHeight: [0, 900],
  borderWidth: [0, 12],
  borderRadius: [0, 80],
  gap: [0, 80],
  aspectRatio: [0.4, 3],
} as const satisfies Record<string, NumberRange>;

type NumberKey = keyof typeof NUMBER_RANGES;

const ENUMS = {
  textAlign: ["left", "center", "right"],
  verticalAlign: ["start", "center", "end"],
  objectFit: ["cover", "contain"],
  boxShadow: ["none", "sm", "md", "lg"],
  fontFamily: ["body", "display"],
  textTransform: ["none", "uppercase"],
} as const satisfies Record<string, readonly string[]>;

const COLOURS = new Set(["textColor", "backgroundColor", "borderColor"]);

/** Properties where a fraction is meaningful, so they keep up to two decimals. */
const DECIMALS = new Set<NumberKey>(["lineHeight", "letterSpacing", "aspectRatio"]);

type Parse<T> = { ok: true; value: T } | { ok: false };

const BAD: { ok: false } = { ok: false };

function parseNumber(key: NumberKey, value: unknown): Parse<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) return BAD;
  const rounded = DECIMALS.has(key) ? Math.round(value * 100) / 100 : Math.round(value);
  const [min, max] = NUMBER_RANGES[key];
  return rounded < min || rounded > max ? BAD : { ok: true, value: rounded };
}

function parseIntInRange(value: unknown, min: number, max: number, fallback: number): number | null {
  const raw = value === undefined ? fallback : value;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  return rounded < min || rounded > max ? null : rounded;
}

function parseColumnsChoice(value: unknown, fallback: 2 | 3 | 4): 2 | 3 | 4 | null {
  const raw = value === undefined ? fallback : value;
  return raw === 2 || raw === 3 || raw === 4 ? raw : null;
}

/** Validates one breakpoint's settings. Unknown keys are ignored. */
export function parseElementStyle(value: unknown): ElementStyle | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const style: ElementStyle = {};

  for (const key of Object.keys(NUMBER_RANGES) as NumberKey[]) {
    if (input[key] === undefined) continue;
    const parsed = parseNumber(key, input[key]);
    if (!parsed.ok) return null;
    style[key] = parsed.value;
  }

  for (const key of Object.keys(ENUMS) as (keyof typeof ENUMS)[]) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string" || !(ENUMS[key] as readonly string[]).includes(raw)) return null;
    (style as Record<string, unknown>)[key] = raw;
  }

  for (const key of COLOURS) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string" || !HEX.test(raw)) return null;
    (style as Record<string, unknown>)[key] = raw.toLowerCase();
  }

  return style;
}

export function parseStyleSet(value: unknown): StyleSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const desktop = parseElementStyle(input.desktop ?? {});
  if (!desktop) return null;
  const set: StyleSet = { desktop };
  for (const breakpoint of ["tablet", "mobile"] as const) {
    if (input[breakpoint] === undefined) continue;
    const parsed = parseElementStyle(input[breakpoint]);
    if (!parsed) return null;
    if (Object.keys(parsed).length) set[breakpoint] = parsed;
  }
  return set;
}

/** Copy, duplicate and move actions must never reuse an id. */
function parseId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}

function parseText(value: unknown, max: number, { empty = true } = {}): string | null {
  if (typeof value !== "string" || value.length > max) return null;
  if (!empty && !value.trim()) return null;
  return value;
}

export function isSafeBuilderLink(value: string): boolean {
  if (value.length > BUILDER_LIMITS.link) return false;
  if (/^\/(?!\/)[^\\\s\x00-\x1f]*$/.test(value)) return true;
  if (/^#[a-z0-9-]{1,60}$/i.test(value)) return true;
  if (/^https:\/\/[^\s\\]+$/i.test(value)) return true;
  if (/^(?:mailto|tel):[^\s\\]+$/i.test(value)) return true;
  return false;
}

export function isBuilderImage(value: string): boolean {
  if (value === "") return false;
  if (!value.startsWith("/") || value.includes("..") || value.includes("\\")) return false;
  if (/^\/api\/product-media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true;
  if (/^\/brand\/[a-z0-9][a-z0-9/_.-]*$/i.test(value)) return true;
  return /^\/img\/[a-z0-9][a-z0-9/_.-]*$/i.test(value);
}

const KIND_FILTERS: readonly ProductGridKindFilter[] = [
  "",
  "tee",
  "polo",
  "longsleeve",
  "hoodie",
  "crew",
  "cap",
  "mug",
  "tote",
  "fleece",
];

function parseWidget(value: unknown): WidgetNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const id = parseId(input.id);
  const style = parseStyleSet(input.style ?? { desktop: {} });
  if (!id || !style) return null;
  const base = { id, style };

  switch (input.kind) {
    case "heading": {
      const text = parseText(input.text, BUILDER_LIMITS.heading);
      const level = input.level === 2 || input.level === 3 ? input.level : 1;
      if (text === null) return null;
      return { ...base, kind: "heading", text, level };
    }
    case "text": {
      const text = parseText(input.text, BUILDER_LIMITS.text);
      return text === null ? null : { ...base, kind: "text", text };
    }
    case "image": {
      const src = typeof input.src === "string" ? input.src : "";
      const alt = parseText(input.alt ?? "", BUILDER_LIMITS.alt);
      const href = typeof input.href === "string" ? input.href : "";
      if (src !== "" && !isBuilderImage(src)) return null;
      if (alt === null) return null;
      if (href !== "" && !isSafeBuilderLink(href)) return null;
      return { ...base, kind: "image", src, alt, href };
    }
    case "button": {
      const text = parseText(input.text, BUILDER_LIMITS.button);
      const href = typeof input.href === "string" ? input.href : "";
      const variant = input.variant === "outline" ? "outline" : "solid";
      if (text === null || !isSafeBuilderLink(href)) return null;
      return { ...base, kind: "button", text, href, variant };
    }
    case "spacer": {
      const rounded = parseIntInRange(input.height, 4, 240, 32);
      if (rounded === null) return null;
      return { ...base, kind: "spacer", height: rounded };
    }
    case "divider":
      return { ...base, kind: "divider" };
    case "faq": {
      if (!Array.isArray(input.items) || input.items.length > BUILDER_LIMITS.faqItems) return null;
      const items: FaqItem[] = [];
      for (const item of input.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const entry = item as Record<string, unknown>;
        const question = parseText(entry.question, BUILDER_LIMITS.question);
        const answer = parseText(entry.answer, BUILDER_LIMITS.answer);
        if (question === null || answer === null) return null;
        items.push({ question, answer });
      }
      return { ...base, kind: "faq", items };
    }
    case "promo-banner": {
      const eyebrow = parseText(input.eyebrow ?? "", BUILDER_LIMITS.eyebrow);
      const heading = parseText(input.heading ?? "", BUILDER_LIMITS.heading);
      const body = parseText(input.body ?? "", BUILDER_LIMITS.body);
      const ctaText = parseText(input.ctaText ?? "", BUILDER_LIMITS.button);
      const ctaHref = typeof input.ctaHref === "string" ? input.ctaHref : "";
      const secondaryCtaText = parseText(input.secondaryCtaText ?? "", BUILDER_LIMITS.button);
      const secondaryCtaHref = typeof input.secondaryCtaHref === "string" ? input.secondaryCtaHref : "";
      const imageSrc = typeof input.imageSrc === "string" ? input.imageSrc : "";
      const imageAlt = parseText(input.imageAlt ?? "", BUILDER_LIMITS.alt);
      const overlay = parseIntInRange(input.overlay, 0, 85, 50);
      const minHeight = parseIntInRange(input.minHeight, 200, 760, 380);
      const align = input.align === "center" ? "center" : "left";
      const theme = input.theme === "light" ? "light" : "dark";
      if (
        eyebrow === null ||
        heading === null ||
        body === null ||
        ctaText === null ||
        secondaryCtaText === null ||
        imageAlt === null ||
        overlay === null ||
        minHeight === null
      ) {
        return null;
      }
      if (ctaHref !== "" && !isSafeBuilderLink(ctaHref)) return null;
      if (secondaryCtaHref !== "" && !isSafeBuilderLink(secondaryCtaHref)) return null;
      if (imageSrc !== "" && !isBuilderImage(imageSrc)) return null;
      return {
        ...base,
        kind: "promo-banner",
        eyebrow,
        heading,
        body,
        ctaText,
        ctaHref,
        secondaryCtaText,
        secondaryCtaHref,
        imageSrc,
        imageAlt,
        overlay,
        minHeight,
        align,
        theme,
      };
    }
    case "product-grid": {
      const heading = parseText(input.heading ?? "", BUILDER_LIMITS.heading);
      const subheading = parseText(input.subheading ?? "", BUILDER_LIMITS.subheading);
      const categorySlug = typeof input.categorySlug === "string" ? input.categorySlug : "";
      const kindFilter = typeof input.kindFilter === "string" ? input.kindFilter : "";
      const featuredOnly = Boolean(input.featuredOnly);
      const limit = parseIntInRange(input.limit, 1, 12, 4);
      const columns = parseColumnsChoice(input.columns, 4);
      const ctaText = parseText(input.ctaText ?? "", BUILDER_LIMITS.button);
      const ctaHref = typeof input.ctaHref === "string" ? input.ctaHref : "";
      if (
        heading === null ||
        subheading === null ||
        ctaText === null ||
        limit === null ||
        columns === null
      ) {
        return null;
      }
      if (categorySlug !== "" && (categorySlug.length > BUILDER_LIMITS.slug || !SLUG.test(categorySlug))) {
        return null;
      }
      if (!KIND_FILTERS.includes(kindFilter as ProductGridKindFilter)) return null;
      if (ctaHref !== "" && !isSafeBuilderLink(ctaHref)) return null;
      return {
        ...base,
        kind: "product-grid",
        heading,
        subheading,
        categorySlug,
        kindFilter: kindFilter as ProductGridKindFilter,
        featuredOnly,
        limit,
        columns,
        ctaText,
        ctaHref,
      };
    }
    case "category-strip": {
      const heading = parseText(input.heading ?? "", BUILDER_LIMITS.heading);
      if (heading === null || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > BUILDER_LIMITS.stripItems) {
        return null;
      }
      const items: CategoryStripItem[] = [];
      for (const item of input.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const entry = item as Record<string, unknown>;
        const label = parseText(entry.label ?? "", BUILDER_LIMITS.label);
        const href = typeof entry.href === "string" ? entry.href : "";
        const imageSrc = typeof entry.imageSrc === "string" ? entry.imageSrc : "";
        if (label === null || !isSafeBuilderLink(href)) return null;
        if (imageSrc !== "" && !isBuilderImage(imageSrc)) return null;
        items.push({ label, href, imageSrc });
      }
      return { ...base, kind: "category-strip", heading, items };
    }
    case "feature-cards": {
      const heading = parseText(input.heading ?? "", BUILDER_LIMITS.heading);
      const subheading = parseText(input.subheading ?? "", BUILDER_LIMITS.subheading);
      const columns = parseColumnsChoice(input.columns, 3);
      const variant = input.variant === "steps" ? "steps" : "cards";
      if (
        heading === null ||
        subheading === null ||
        columns === null ||
        !Array.isArray(input.items) ||
        input.items.length < 1 ||
        input.items.length > BUILDER_LIMITS.featureItems
      ) {
        return null;
      }
      const items: FeatureCardItem[] = [];
      for (const item of input.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const entry = item as Record<string, unknown>;
        const badge = parseText(entry.badge ?? "", BUILDER_LIMITS.badge);
        const title = parseText(entry.title ?? "", BUILDER_LIMITS.cardTitle);
        const body = parseText(entry.body ?? "", BUILDER_LIMITS.cardBody);
        if (badge === null || title === null || body === null) return null;
        items.push({ badge, title, body });
      }
      return { ...base, kind: "feature-cards", heading, subheading, columns, variant, items };
    }
    case "image-gallery": {
      const heading = parseText(input.heading ?? "", BUILDER_LIMITS.heading);
      const columns = parseColumnsChoice(input.columns, 4);
      const rawRatio = input.aspectRatio === undefined ? 1 : input.aspectRatio;
      if (typeof rawRatio !== "number" || !Number.isFinite(rawRatio)) return null;
      const aspectRatio = Math.round(rawRatio * 100) / 100;
      if (
        heading === null ||
        columns === null ||
        aspectRatio < 0.5 ||
        aspectRatio > 2.5 ||
        !Array.isArray(input.items) ||
        input.items.length < 1 ||
        input.items.length > BUILDER_LIMITS.galleryItems
      ) {
        return null;
      }
      const items: GalleryImageItem[] = [];
      for (const item of input.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const entry = item as Record<string, unknown>;
        const src = typeof entry.src === "string" ? entry.src : "";
        const alt = parseText(entry.alt ?? "", BUILDER_LIMITS.alt);
        const caption = parseText(entry.caption ?? "", BUILDER_LIMITS.caption);
        const href = typeof entry.href === "string" ? entry.href : "";
        if (src !== "" && !isBuilderImage(src)) return null;
        if (alt === null || caption === null) return null;
        if (href !== "" && !isSafeBuilderLink(href)) return null;
        items.push({ src, alt, caption, href });
      }
      return { ...base, kind: "image-gallery", heading, columns, aspectRatio, items };
    }
    case "contact-block": {
      const heading = parseText(input.heading ?? "", BUILDER_LIMITS.heading);
      const body = parseText(input.body ?? "", BUILDER_LIMITS.body);
      if (heading === null || body === null) return null;
      return {
        ...base,
        kind: "contact-block",
        heading,
        body,
        showDetails: input.showDetails !== false,
        showQuickLinks: input.showQuickLinks !== false,
      };
    }
    default:
      return null;
  }
}

function parseBackgroundFields(
  input: Record<string, unknown>
): { ok: true; backgroundImage?: string; backgroundOverlay?: number } | { ok: false } {
  let backgroundImage: string | undefined;
  if (input.backgroundImage !== undefined && input.backgroundImage !== "") {
    if (typeof input.backgroundImage !== "string" || !isBuilderImage(input.backgroundImage)) {
      return BAD;
    }
    backgroundImage = input.backgroundImage;
  }
  let backgroundOverlay: number | undefined;
  if (input.backgroundOverlay !== undefined) {
    const parsed = parseIntInRange(input.backgroundOverlay, 0, 85, 0);
    if (parsed === null) return BAD;
    backgroundOverlay = parsed;
  }
  return {
    ok: true,
    ...(backgroundImage !== undefined ? { backgroundImage } : {}),
    ...(backgroundOverlay !== undefined ? { backgroundOverlay } : {}),
  };
}

function parseColumn(value: unknown): ColumnNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const id = parseId(input.id);
  const style = parseStyleSet(input.style ?? { desktop: {} });
  const bg = parseBackgroundFields(input);
  if (!id || !style || !bg.ok) return null;
  if (!Array.isArray(input.widgets) || input.widgets.length > BUILDER_LIMITS.widgets) return null;

  const widgets: WidgetNode[] = [];
  const ids = new Set<string>();
  for (const entry of input.widgets) {
    const widget = parseWidget(entry);
    if (!widget || ids.has(widget.id)) return null;
    ids.add(widget.id);
    widgets.push(widget);
  }
  return {
    id,
    kind: "column",
    style,
    widgets,
    ...(bg.backgroundImage !== undefined ? { backgroundImage: bg.backgroundImage } : {}),
    ...(bg.backgroundOverlay !== undefined ? { backgroundOverlay: bg.backgroundOverlay } : {}),
  };
}

function parseSection(value: unknown): SectionNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const id = parseId(input.id);
  const style = parseStyleSet(input.style ?? { desktop: {} });
  const bg = parseBackgroundFields(input);
  if (!id || !style || !bg.ok) return null;
  if (!Array.isArray(input.columns) || input.columns.length < 1 || input.columns.length > BUILDER_LIMITS.columns) return null;

  const columns: ColumnNode[] = [];
  const ids = new Set<string>();
  for (const entry of input.columns) {
    const column = parseColumn(entry);
    if (!column || ids.has(column.id)) return null;
    ids.add(column.id);
    columns.push(column);
  }
  return {
    id,
    kind: "section",
    boxed: input.boxed !== false,
    style,
    columns,
    ...(bg.backgroundImage !== undefined ? { backgroundImage: bg.backgroundImage } : {}),
    ...(bg.backgroundOverlay !== undefined ? { backgroundOverlay: bg.backgroundOverlay } : {}),
  };
}

export function countNodes(layout: BuilderLayout): number {
  let total = 0;
  for (const section of layout.sections) {
    total += 1;
    for (const column of section.columns) total += 1 + column.widgets.length;
  }
  return total;
}

export function parseBuilderLayout(value: unknown): BuilderLayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.version !== 1) return null;
  if (!Array.isArray(input.sections) || input.sections.length > BUILDER_LIMITS.sections) return null;

  const sections: SectionNode[] = [];
  const ids = new Set<string>();
  for (const entry of input.sections) {
    const section = parseSection(entry);
    if (!section || ids.has(section.id)) return null;
    ids.add(section.id);
    for (const column of section.columns) {
      if (ids.has(column.id)) return null;
      ids.add(column.id);
      for (const widget of column.widgets) {
        if (ids.has(widget.id)) return null;
        ids.add(widget.id);
      }
    }
    sections.push(section);
  }

  const layout: BuilderLayout = { version: 1, sections };
  return countNodes(layout) > BUILDER_LIMITS.nodes ? null : layout;
}

export function isEditableStoreSlug(value: string): value is EditableStoreSlug {
  return (EDITABLE_STORE_SLUGS as readonly string[]).includes(value);
}

export function isBuilderSlug(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= BUILDER_LIMITS.slug &&
    SLUG.test(value) &&
    (isEditableStoreSlug(value) || !(RESERVED_PAGE_SLUGS as readonly string[]).includes(value))
  );
}

export function parseBuilderPage(value: unknown): BuilderPage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.slug !== "string" || !isBuilderSlug(input.slug)) return null;
  const title = parseText(input.title, BUILDER_LIMITS.title, { empty: false });
  const description = parseText(input.description ?? "", BUILDER_LIMITS.description);
  if (title === null || description === null) return null;
  if (typeof input.updatedAt !== "string" || Number.isNaN(Date.parse(input.updatedAt))) return null;
  const layout = parseBuilderLayout(input.layout);
  if (!layout) return null;
  return {
    slug: input.slug,
    title,
    description,
    showTitle: input.showTitle !== false,
    layout,
    updatedAt: input.updatedAt,
  };
}

export function widgetHasContent(widget: WidgetNode): boolean {
  switch (widget.kind) {
    case "heading":
    case "text":
    case "button":
      return widget.text.trim() !== "";
    case "image":
      return widget.src !== "";
    case "faq":
      return widget.items.length > 0;
    case "spacer":
    case "divider":
    case "product-grid":
    case "contact-block":
      return true;
    case "promo-banner":
      return Boolean(widget.heading.trim() || widget.body.trim() || widget.imageSrc);
    case "category-strip":
    case "feature-cards":
      return widget.items.length > 0;
    case "image-gallery":
      return widget.items.some((item) => item.src !== "");
  }
}

export function layoutHasContent(layout: BuilderLayout): boolean {
  return layout.sections.some((section) =>
    section.columns.some((column) => column.widgets.some(widgetHasContent))
  );
}

/* -------------------------------------------------------------------------
   Factories used by the editor. Ids come from crypto.randomUUID so a
   duplicated node never collides with the original.
   ------------------------------------------------------------------------- */

export function newId(): string {
  return crypto.randomUUID();
}

export function newWidget(kind: WidgetKind): WidgetNode {
  const base = { id: newId(), style: { desktop: {} } } as const;
  switch (kind) {
    case "heading":
      return { ...base, kind, text: "New heading", level: 2, style: { desktop: { fontSize: 40, fontWeight: 600, lineHeight: 1.1 } } };
    case "text":
      return {
        ...base,
        kind,
        text: "Write something here.\nAdd a second line if you need one.",
        style: { desktop: { fontSize: 17, lineHeight: 1.6 } },
      };
    case "image":
      return { ...base, kind, src: "", alt: "", href: "" };
    case "button":
      return { ...base, kind, text: "Get in touch", href: "/contact", variant: "solid" };
    case "spacer":
      return { ...base, kind, height: 32 };
    case "divider":
      return { ...base, kind };
    case "faq":
      return {
        ...base,
        kind,
        items: [{ question: "Your question", answer: "The answer customers should see." }],
      };
    case "promo-banner":
      return {
        ...base,
        kind,
        eyebrow: "Custom print studio",
        heading: "Your ideas, made to wear.",
        body: "Pick a blank, upload artwork or design in your browser, and check out with clear quantity breaks.",
        ctaText: "Start designing",
        ctaHref: "/customize",
        secondaryCtaText: "Shop blanks",
        secondaryCtaHref: "/shop",
        imageSrc: "/img/shop-printing.png",
        imageAlt: "Custom artwork printed on a garment",
        overlay: 58,
        minHeight: 380,
        align: "left",
        theme: "dark",
        style: { desktop: { borderRadius: 16 } },
      };
    case "product-grid":
      return {
        ...base,
        kind,
        heading: "Featured blanks",
        subheading: "Choose a blank and start customizing in your browser.",
        categorySlug: "",
        kindFilter: "",
        featuredOnly: true,
        limit: 4,
        columns: 4,
        ctaText: "View all products",
        ctaHref: "/shop",
      };
    case "category-strip":
      return {
        ...base,
        kind,
        heading: "Shop by category",
        items: [
          { label: "Shirts", href: "/shop?kind=tee", imageSrc: "/img/category-prints/shirts.webp" },
          { label: "Polos", href: "/shop?kind=polo", imageSrc: "/img/category-prints/polos.webp" },
          { label: "Hoodies", href: "/shop?kind=fleece", imageSrc: "/img/category-prints/hoodies.webp" },
          { label: "Caps", href: "/shop?kind=cap", imageSrc: "/img/category-prints/caps.webp" },
          { label: "Totes", href: "/shop?kind=tote", imageSrc: "/img/category-prints/totes.webp" },
          { label: "Merch", href: "/shop?kind=mug", imageSrc: "/img/category-prints/merch.webp" },
        ],
      };
    case "feature-cards":
      return {
        ...base,
        kind,
        heading: "How custom printing works",
        subheading: "Pick a garment, add your artwork, and review every detail before ordering.",
        columns: 3,
        variant: "steps",
        items: [
          { badge: "01", title: "Choose a garment", body: "Browse weights, colors, and print sizes across our blanks." },
          { badge: "02", title: "Add your artwork", body: "Upload graphics or arrange text on the front and back." },
          { badge: "03", title: "Review and order", body: "Set your size run with live quantity-break pricing." },
        ],
      };
    case "image-gallery":
      return {
        ...base,
        kind,
        heading: "Shop by collection",
        columns: 4,
        aspectRatio: 1,
        items: [
          { src: "/img/collections/shirts.jpg", alt: "Custom printed t-shirts", caption: "Custom Shirts", href: "/shop?kind=tee" },
          { src: "/img/collections/totes.jpg", alt: "Custom printed tote bags", caption: "Custom Totes", href: "/shop?kind=tote" },
          { src: "/img/collections/caps.jpg", alt: "Custom printed caps", caption: "Caps & Hats", href: "/shop?kind=cap" },
          { src: "/img/collections/merch.jpg", alt: "Custom printed mugs and merchandise", caption: "Mugs & Merch", href: "/shop?category=accessories" },
        ],
      };
    case "contact-block":
      return {
        ...base,
        kind,
        heading: "Talk to us",
        body: "Questions about artwork, sizing, or a group order? Send us the details and we will get back to you.",
        showDetails: true,
        showQuickLinks: true,
      };
  }
}

export function newColumn(columnWidth = 100): ColumnNode {
  return { id: newId(), kind: "column", style: { desktop: { columnWidth } }, widgets: [] };
}

export function newSection(): SectionNode {
  return { id: newId(), kind: "section", boxed: true, style: { desktop: {} }, columns: [newColumn()] };
}

export function newLayout(): BuilderLayout {
  return { version: 1, sections: [newSection()] };
}
