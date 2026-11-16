/**
 * Schema for store pages an administrator creates in the dashboard.
 *
 * Pages are stored as JSON in site_settings, so no schema migration is needed.
 * Everything here is shared by the admin editor and the public renderer.
 */

/** Slugs that would collide with an existing route or framework path. */
export const RESERVED_PAGE_SLUGS = [
  "about", "account", "admin", "api", "cart", "checkout", "contact", "customize",
  "faq", "homepage-preview", "invoice", "order", "privacy", "product", "qa-admin-preview",
  "qa-commerce-preview", "qa-design-admin", "qa-inventory-preview", "quote", "shipping",
  "shop", "skeleton-check-local", "terms", "track", "wishlist", "_next", "img", "brand",
] as const;

export const PAGE_LIMITS = {
  pages: 20,
  blocks: 40,
  title: 100,
  description: 300,
  heading: 140,
  paragraph: 2000,
  buttonText: 60,
  alt: 160,
  faqItems: 12,
  question: 160,
  answer: 600,
} as const;

export type PageBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; src: string; alt: string }
  | { id: string; type: "button"; text: string; href: string }
  | { id: string; type: "faq"; items: { question: string; answer: string }[] };

export type PageBlockType = PageBlock["type"];

export type CustomPage = {
  id: string;
  slug: string;
  title: string;
  description: string;
  blocks: PageBlock[];
  published: boolean;
  updatedAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPageSlug(value: string): boolean {
  return value.length >= 1 && value.length <= 60 && SLUG.test(value) && !(RESERVED_PAGE_SLUGS as readonly string[]).includes(value);
}

/** Turns a title into a slug an administrator can edit. */
export function pageSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Storefront links must stay on the site. */
export function isSafePageLink(value: string): boolean {
  return value.length <= 300 && /^\/(?!\/)[^\\\s\x00-\x1f]*$/.test(value);
}

export function isPageImage(value: string): boolean {
  return value === ""
    || ["/img/shop-studio.png", "/img/shop-printing.png", "/img/kingdom-team.webp", "/img/loyalty-group.webp"].includes(value)
    || /^\/api\/product-media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

export function parsePageBlock(value: unknown): PageBlock | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || !UUID.test(input.id)) return null;
  switch (input.type) {
    case "heading": {
      const body = text(input.text, PAGE_LIMITS.heading);
      return body === null ? null : { id: input.id, type: "heading", text: body };
    }
    case "paragraph": {
      const body = text(input.text, PAGE_LIMITS.paragraph);
      return body === null ? null : { id: input.id, type: "paragraph", text: body };
    }
    case "image": {
      const src = text(input.src, 300);
      const alt = text(input.alt ?? "", PAGE_LIMITS.alt);
      if (src === null || alt === null || !isPageImage(src)) return null;
      return { id: input.id, type: "image", src, alt };
    }
    case "button": {
      const body = text(input.text, PAGE_LIMITS.buttonText);
      const href = text(input.href, 300);
      if (body === null || href === null || !isSafePageLink(href)) return null;
      return { id: input.id, type: "button", text: body, href };
    }
    case "faq": {
      if (!Array.isArray(input.items) || input.items.length > PAGE_LIMITS.faqItems) return null;
      const items: { question: string; answer: string }[] = [];
      for (const item of input.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const entry = item as Record<string, unknown>;
        const question = text(entry.question, PAGE_LIMITS.question);
        const answer = text(entry.answer, PAGE_LIMITS.answer);
        if (question === null || answer === null) return null;
        items.push({ question, answer });
      }
      return { id: input.id, type: "faq", items };
    }
    default:
      return null;
  }
}

export function parseCustomPage(value: unknown): CustomPage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || !UUID.test(input.id)) return null;
  if (typeof input.slug !== "string" || !isPageSlug(input.slug)) return null;
  const title = text(input.title, PAGE_LIMITS.title);
  const description = text(input.description ?? "", PAGE_LIMITS.description);
  if (title === null || description === null || !title.trim()) return null;
  if (typeof input.published !== "boolean") return null;
  if (typeof input.updatedAt !== "string" || Number.isNaN(Date.parse(input.updatedAt))) return null;
  if (!Array.isArray(input.blocks) || input.blocks.length > PAGE_LIMITS.blocks) return null;
  const blocks: PageBlock[] = [];
  const ids = new Set<string>();
  for (const value of input.blocks) {
    const block = parsePageBlock(value);
    if (!block || ids.has(block.id)) return null;
    ids.add(block.id);
    blocks.push(block);
  }
  return { id: input.id, slug: input.slug, title, description, blocks, published: input.published, updatedAt: input.updatedAt };
}

/** Reads a stored list, dropping entries that no longer validate. */
export function parseCustomPages(value: unknown): CustomPage[] {
  if (!Array.isArray(value)) return [];
  const pages: CustomPage[] = [];
  const slugs = new Set<string>();
  for (const item of value) {
    const page = parseCustomPage(item);
    if (!page || slugs.has(page.slug)) continue;
    slugs.add(page.slug);
    pages.push(page);
    if (pages.length === PAGE_LIMITS.pages) break;
  }
  return pages;
}

export function newPageBlock(type: PageBlockType): PageBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading": return { id, type, text: "" };
    case "paragraph": return { id, type, text: "" };
    case "image": return { id, type, src: "", alt: "" };
    case "button": return { id, type, text: "", href: "" };
    case "faq": return { id, type, items: [{ question: "", answer: "" }] };
  }
}
