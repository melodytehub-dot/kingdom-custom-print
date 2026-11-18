/**
 * Turns a saved layout into one stylesheet.
 *
 * Inline styles cannot express tablet/mobile overrides, so each element gets a
 * class derived from its id and its settings become CSS rules inside media
 * queries. Values were validated by `lib/builder/schema.ts`; they are clamped
 * and re-checked here as well, so the generated text can only ever contain
 * numbers, hex colours and the handful of keywords the schema allows.
 */
import {
  type Breakpoint,
  type BuilderLayout,
  type BuilderNode,
  type ColumnNode,
  type ElementStyle,
} from "./schema";

export const BREAKPOINT_MAX_WIDTH: Record<Exclude<Breakpoint, "desktop">, number> = {
  tablet: 1024,
  mobile: 640,
};

const HEX = /^#[0-9a-f]{6}$/i;

function px(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}px` : null;
}

function colour(value: unknown): string | null {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : null;
}

function unitless(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

const TEXT_ALIGN = ["left", "center", "right"] as const;
const VERTICAL_ALIGN = { start: "flex-start", center: "center", end: "flex-end" } as const;
const OBJECT_FIT = ["cover", "contain"] as const;
const BOX_SHADOW = {
  none: "none",
  sm: "0 2px 8px rgba(17,17,16,.06)",
  md: "0 8px 24px rgba(17,17,16,.1)",
  lg: "0 18px 42px rgba(17,17,16,.14)",
} as const;
const FONT_FAMILY = {
  body: "var(--font-body)",
  display: "var(--font-display)",
} as const;
const TEXT_TRANSFORM = ["none", "uppercase"] as const;

function declarations(node: BuilderNode, style: ElementStyle): string[] {
  const out: string[] = [];
  const add = (property: string, value: string | null) => {
    if (value !== null) out.push(`${property}:${value}`);
  };

  if (node.kind === "column") {
    const width = style.columnWidth;
    if (typeof width === "number") {
      const clamped = Math.min(100, Math.max(10, Math.round(width)));
      add("flex", `0 0 ${clamped}%`);
      add("max-width", `${clamped}%`);
    }
  }

  add("font-size", px(style.fontSize));
  add("font-weight", unitless(style.fontWeight));
  const family = oneOf(style.fontFamily, ["body", "display"] as const);
  if (family) add("font-family", FONT_FAMILY[family]);
  add("text-transform", oneOf(style.textTransform, TEXT_TRANSFORM));
  add("line-height", unitless(style.lineHeight));
  add("letter-spacing", px(style.letterSpacing));
  add("text-align", oneOf(style.textAlign, TEXT_ALIGN));
  add("color", colour(style.textColor));
  add("background-color", colour(style.backgroundColor));

  add("padding-top", px(style.paddingTop));
  add("padding-right", px(style.paddingRight));
  add("padding-bottom", px(style.paddingBottom));
  add("padding-left", px(style.paddingLeft));
  add("margin-top", px(style.marginTop));
  add("margin-bottom", px(style.marginBottom));

  if (typeof style.maxWidth === "number" && style.maxWidth > 0) {
    add("max-width", px(style.maxWidth));
    add("margin-left", "auto");
    add("margin-right", "auto");
  }
  if (typeof style.minHeight === "number" && style.minHeight > 0) {
    add("min-height", px(style.minHeight));
  }

  if (typeof style.borderWidth === "number" && style.borderWidth > 0) {
    const borderColour = colour(style.borderColor) ?? "#e5e2dd";
    add("border", `${Math.round(style.borderWidth)}px solid ${borderColour}`);
  }
  add("border-radius", px(style.borderRadius));
  const shadow = oneOf(style.boxShadow, ["none", "sm", "md", "lg"] as const);
  if (shadow) add("box-shadow", BOX_SHADOW[shadow]);

  // A section is a block with a flex row inside, so its gap belongs on the row.
  if (node.kind !== "section") add("gap", px(style.gap));
  const vertical = oneOf(style.verticalAlign, ["start", "center", "end"] as const);
  if (vertical) add("justify-content", VERTICAL_ALIGN[vertical]);
  add("object-fit", oneOf(style.objectFit, OBJECT_FIT));

  return out;
}

/** Rules that target an element's inner structure rather than the element. */
function structuralRules(node: BuilderNode, style: ElementStyle): string[] {
  const out: string[] = [];
  if (node.kind === "section" && typeof style.gap === "number" && Number.isFinite(style.gap)) {
    out.push(`.${classFor(node)}>.kcp-b-row{gap:${Math.round(style.gap)}px}`);
  }
  if (node.kind === "image" && typeof style.aspectRatio === "number" && Number.isFinite(style.aspectRatio)) {
    const ratio = Math.min(3, Math.max(0.4, Math.round(style.aspectRatio * 100) / 100));
    out.push(`.${classFor(node)} .kcp-b-image-frame{aspect-ratio:${ratio}}`);
  }
  return out;
}

function classFor(node: BuilderNode): string {
  return `kcp-b-${node.id}`;
}

function rule(node: BuilderNode, style: ElementStyle): string {
  const body = declarations(node, style);
  return body.length ? `.${classFor(node)}{${body.join(";")}}` : "";
}

function eachNode(layout: BuilderLayout, visit: (node: BuilderNode) => void): void {
  for (const section of layout.sections) {
    visit(section);
    for (const column of section.columns) {
      visit(column);
      for (const widget of column.widgets) visit(widget);
    }
  }
}

/** Columns stack on phones unless the owner set a mobile width. */
function mobileColumnDefault(column: ColumnNode): string {
  if (column.style.mobile?.columnWidth !== undefined) return "";
  return `.${classFor(column)}{flex:0 0 100%;max-width:100%}`;
}

/**
 * Tablet and mobile rules use container queries rather than media queries.
 * The public page's width is the viewport, but in the editor the same page is
 * drawn in a resizable canvas, so a phone-width preview really applies the
 * phone rules instead of pretending the whole browser is narrow.
 */
function block(query: string, rules: string[]): string {
  const body = rules.filter(Boolean).join("\n");
  return body ? `@container kcp-page (max-width:${query}px){\n${body}\n}` : "";
}

export function builderStylesheet(layout: BuilderLayout): string {
  const desktop: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];

  eachNode(layout, (node) => {
    desktop.push(rule(node, node.style.desktop), ...structuralRules(node, node.style.desktop));
    if (node.style.tablet) {
      tablet.push(rule(node, node.style.tablet), ...structuralRules(node, node.style.tablet));
    }
    if (node.style.mobile) {
      mobile.push(rule(node, node.style.mobile), ...structuralRules(node, node.style.mobile));
    }
  });

  // Emitted after the owner's mobile rules would win, so keep this first.
  for (const section of layout.sections) {
    for (const column of section.columns) mobile.unshift(mobileColumnDefault(column));
  }

  return [
    desktop.filter(Boolean).join("\n"),
    block(String(BREAKPOINT_MAX_WIDTH.tablet), tablet),
    block(String(BREAKPOINT_MAX_WIDTH.mobile), mobile),
  ]
    .filter(Boolean)
    .join("\n");
}

/** The settings an element actually renders with on one screen size. */
export function effectiveStyle(node: BuilderNode, breakpoint: Breakpoint): ElementStyle {
  if (breakpoint === "desktop") return node.style.desktop;
  if (breakpoint === "tablet") return { ...node.style.desktop, ...node.style.tablet };
  return { ...node.style.desktop, ...node.style.tablet, ...node.style.mobile };
}

/** True when the owner set this property for this screen size specifically. */
export function isOverridden(node: BuilderNode, breakpoint: Breakpoint, key: keyof ElementStyle): boolean {
  const scoped = breakpoint === "desktop" ? node.style.desktop : node.style[breakpoint];
  return scoped?.[key] !== undefined;
}
