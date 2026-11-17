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

export const BUILDER_LIMITS = {
  sections: 24,
  columns: 4,
  widgets: 24,
  nodes: 400,
  heading: 200,
  text: 4000,
  alt: 160,
  button: 80,
  link: 300,
  faqItems: 12,
  question: 160,
  answer: 900,
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

/**
 * Visual settings for one element. Everything is optional, so an element only
 * carries the properties the owner actually set.
 */
export type ElementStyle = {
  columnWidth?: number;
  fontSize?: number;
  fontWeight?: number;
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
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
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
  | "faq";

type NodeBase = { id: string; style: StyleSet };

export type FaqItem = { question: string; answer: string };

export type WidgetNode = NodeBase &
  (
    | { kind: "heading"; text: string; level: 1 | 2 | 3 }
    | { kind: "text"; text: string }
    | { kind: "image"; src: string; alt: string; href: string }
    | { kind: "button"; text: string; href: string; variant: "solid" | "outline" }
    | { kind: "spacer"; height: number }
    | { kind: "divider" }
    | { kind: "faq"; items: FaqItem[] }
  );

export type ColumnNode = NodeBase & { kind: "column"; widgets: WidgetNode[] };
/** `boxed` keeps the row inside the store's content width; off is full-bleed. */
export type SectionNode = NodeBase & { kind: "section"; boxed: boolean; columns: ColumnNode[] };

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
  return /^\/img\/[a-z0-9][a-z0-9/_.-]*$/i.test(value);
}

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
      const height = input.height === undefined ? 32 : input.height;
      if (typeof height !== "number" || !Number.isFinite(height)) return null;
      const rounded = Math.round(height);
      if (rounded < 4 || rounded > 240) return null;
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
    default:
      return null;
  }
}

function parseColumn(value: unknown): ColumnNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const id = parseId(input.id);
  const style = parseStyleSet(input.style ?? { desktop: {} });
  if (!id || !style) return null;
  if (!Array.isArray(input.widgets) || input.widgets.length > BUILDER_LIMITS.widgets) return null;

  const widgets: WidgetNode[] = [];
  const ids = new Set<string>();
  for (const entry of input.widgets) {
    const widget = parseWidget(entry);
    if (!widget || ids.has(widget.id)) return null;
    ids.add(widget.id);
    widgets.push(widget);
  }
  return { id, kind: "column", style, widgets };
}

function parseSection(value: unknown): SectionNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const id = parseId(input.id);
  const style = parseStyleSet(input.style ?? { desktop: {} });
  if (!id || !style) return null;
  if (!Array.isArray(input.columns) || input.columns.length < 1 || input.columns.length > BUILDER_LIMITS.columns) return null;

  const columns: ColumnNode[] = [];
  const ids = new Set<string>();
  for (const entry of input.columns) {
    const column = parseColumn(entry);
    if (!column || ids.has(column.id)) return null;
    ids.add(column.id);
    columns.push(column);
  }
  return { id, kind: "section", boxed: input.boxed !== false, style, columns };
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

export function isBuilderSlug(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= BUILDER_LIMITS.slug &&
    SLUG.test(value) &&
    !(RESERVED_PAGE_SLUGS as readonly string[]).includes(value)
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
