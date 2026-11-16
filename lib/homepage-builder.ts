/** The homepage's existing sections, in their original display order. */
export const HOMEPAGE_SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "hero-actions", label: "Hero buttons" },
  { id: "category-strip", label: "Category links" },
  { id: "ready-to-ship", label: "Ready to ship" },
  { id: "featured-products", label: "Featured products" },
  { id: "design-banner", label: "Design banner" },
  { id: "categories", label: "Shop by category" },
  { id: "products", label: "Make it yours" },
  { id: "projects", label: "Project ideas" },
  { id: "process", label: "How it works" },
  { id: "questions", label: "Questions" },
  { id: "contact", label: "Contact" },
] as const;

export type HomepageSectionId = (typeof HOMEPAGE_SECTIONS)[number]["id"] | `custom-${string}`;
export type HomepageMessageStyle = { tone: "rose" | "ivory" | "dark"; alignment: "left" | "center"; imagePosition: "left" | "right" };
export const DEFAULT_MESSAGE_STYLE: HomepageMessageStyle = { tone: "rose", alignment: "left", imagePosition: "right" };
export type HomepageCustomBlock = { id: `custom-${string}`; type: "message" | "faq" | "products"; heading: string; description: string; buttonText: string; buttonLink: string; image?: string; imageAlt?: string; faqItems?: { question: string; answer: string }[]; productIds?: number[]; style?: HomepageMessageStyle };

export const HOMEPAGE_CONTENT_FIELDS = [
  { name: "heroLabel", dbKey: "hero_label", label: "Hero small heading", max: 80, section: "hero" },
  { name: "heroHeadlineTop", dbKey: "hero_headline_top", label: "Hero headline, first line", max: 100, section: "hero" },
  { name: "heroHeadlineBottom", dbKey: "hero_headline_bottom", label: "Hero headline, second line", max: 100, section: "hero" },
  { name: "heroDescription", dbKey: "hero_description", label: "Hero description", max: 350, section: "hero", multiline: true },
  { name: "heroImage1", dbKey: "hero_image_1", label: "Hero image 1", max: 200, section: "hero", image: true },
  { name: "heroImage2", dbKey: "hero_image_2", label: "Hero image 2", max: 200, section: "hero", image: true },
  { name: "heroImage3", dbKey: "hero_image_3", label: "Hero image 3", max: 200, section: "hero", image: true },
  { name: "homeProductsTitle", dbKey: "home_products_title", label: "Products heading", max: 100, section: "products" },
  { name: "homeProductsDescription", dbKey: "home_products_description", label: "Products description", max: 350, section: "products", multiline: true },
  { name: "homeContactTitle", dbKey: "home_contact_title", label: "Contact heading", max: 100, section: "contact" },
  { name: "homeContactDescription", dbKey: "home_contact_description", label: "Contact description", max: 350, section: "contact", multiline: true },
] as const;

export type HomepageContentKey = (typeof HOMEPAGE_CONTENT_FIELDS)[number]["name"];
export type HomepageContent = Record<HomepageContentKey, string>;

export const DEFAULT_DESIGN_BANNER = {
  eyebrow: "Made for you",
  heading: "Your next idea starts here.",
  description: "Choose a style and make it your own.",
  buttonText: "Start designing",
  buttonLink: "/customize",
};
export type DesignBanner = typeof DEFAULT_DESIGN_BANNER;
export const DEFAULT_HERO_ACTIONS = { primaryText: "Shop now", primaryLink: "/shop", secondaryText: "Design your own", secondaryLink: "/customize" };
export type HomepageHeroActions = typeof DEFAULT_HERO_ACTIONS;
export type HomepageQuestions = { titleTop: string; titleBottom: string; introduction: string; items: { question: string; answer: string; linkText: string; link: string }[] };
export const DEFAULT_HOMEPAGE_QUESTIONS: HomepageQuestions = { titleTop: "Good questions.", titleBottom: "Clear answers.", introduction: "Everything you need to get started with your custom order.", items: [
  { question: "What can I add to a design?", answer: "You can add text, choose graphics or upload your own artwork in the design studio.", linkText: "", link: "" },
  { question: "Can I see my design before I order?", answer: "Yes. The studio lets you preview your design and review its placement before checkout.", linkText: "", link: "" },
  { question: "Need help with a group order?", answer: "Tell us about your project and we can help you plan your order.", linkText: "Get in touch", link: "/contact" },
] };

/** Storefront links must stay on the site, including when entered by an administrator. */
export function isSafeHomepageLink(value: string): boolean {
  return value.length <= 300 && /^\/(?!\/)[^\\\s\x00-\x1f]*$/.test(value);
}

export function parseDesignBanner(value: unknown): DesignBanner | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const limits: Record<keyof DesignBanner, number> = { eyebrow: 80, heading: 100, description: 350, buttonText: 60, buttonLink: 300 };
  for (const key of Object.keys(limits) as (keyof DesignBanner)[]) {
    if (typeof input[key] !== "string" || (input[key] as string).length > limits[key]) return null;
  }
  if (!isSafeHomepageLink(input.buttonLink as string)) return null;
  return { eyebrow: input.eyebrow as string, heading: input.heading as string, description: input.description as string, buttonText: input.buttonText as string, buttonLink: input.buttonLink as string };
}

export function parseHeroActions(value: unknown): HomepageHeroActions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.primaryText !== "string" || input.primaryText.length > 60 || typeof input.secondaryText !== "string" || input.secondaryText.length > 60 || typeof input.primaryLink !== "string" || !isSafeHomepageLink(input.primaryLink) || typeof input.secondaryLink !== "string" || !isSafeHomepageLink(input.secondaryLink)) return null;
  return { primaryText: input.primaryText, primaryLink: input.primaryLink, secondaryText: input.secondaryText, secondaryLink: input.secondaryLink };
}

export function parseHomepageQuestions(value: unknown): HomepageQuestions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.titleTop !== "string" || input.titleTop.length > 100 || typeof input.titleBottom !== "string" || input.titleBottom.length > 100 || typeof input.introduction !== "string" || input.introduction.length > 350 || !Array.isArray(input.items) || input.items.length > 6) return null;
  const items: HomepageQuestions["items"] = [];
  for (const value of input.items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (typeof item.question !== "string" || item.question.length > 160 || typeof item.answer !== "string" || item.answer.length > 600 || typeof item.linkText !== "string" || item.linkText.length > 60 || typeof item.link !== "string" || (item.link !== "" && !isSafeHomepageLink(item.link))) return null;
    items.push({ question: item.question, answer: item.answer, linkText: item.linkText, link: item.link });
  }
  return { titleTop: input.titleTop, titleBottom: input.titleBottom, introduction: input.introduction, items };
}

export function isHomepageImage(value: string): boolean {
  return ["/img/shop-studio.png", "/img/shop-printing.png", "/img/kingdom-team.webp"].includes(value)
    || /^\/api\/product-media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function homepageContentFromSettings(settings: Record<HomepageContentKey, string>): HomepageContent {
  return Object.fromEntries(HOMEPAGE_CONTENT_FIELDS.map(field => [field.name, settings[field.name]])) as HomepageContent;
}

export function parseHomepageContent(value: unknown): HomepageContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const content = {} as HomepageContent;
  for (const field of HOMEPAGE_CONTENT_FIELDS) {
    const text = input[field.name];
    if (typeof text !== "string" || text.length > field.max || ("image" in field && !isHomepageImage(text))) return null;
    content[field.name] = text;
  }
  return content;
}

export interface HomepageLayout {
  version: 1;
  sections: HomepageSectionId[];
  hiddenSections?: HomepageSectionId[];
  content?: HomepageContent;
  baseContent?: HomepageContent;
  designBanner?: DesignBanner;
  heroActions?: HomepageHeroActions;
  questionsContent?: HomepageQuestions;
  customBlocks?: HomepageCustomBlock[];
  baseStructure?: string;
}

/** Snapshot of the published layout used to detect edits made in another session. */
export function homepageStructure(layout: HomepageLayout): string {
  return JSON.stringify({ sections: layout.sections, hiddenSections: layout.hiddenSections ?? [], designBanner: layout.designBanner ?? null, customBlocks: layout.customBlocks ?? [], ...(layout.heroActions ? { heroActions: layout.heroActions } : {}), ...(layout.questionsContent ? { questionsContent: layout.questionsContent } : {}) });
}

export function defaultHomepageLayout(): HomepageLayout {
  return { version: 1, sections: HOMEPAGE_SECTIONS.map(section => section.id), hiddenSections: [] };
}

/** Reject unknown or repeated sections before saving data or rendering it. */
export function parseHomepageLayout(value: unknown): HomepageLayout | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { version?: unknown; sections?: unknown; hiddenSections?: unknown; content?: unknown; baseContent?: unknown; designBanner?: unknown; heroActions?: unknown; questionsContent?: unknown; customBlocks?: unknown; baseStructure?: unknown };
  if (input.version !== 1 || !Array.isArray(input.sections)) return null;
  const allowed = new Set<string>(HOMEPAGE_SECTIONS.map(section => section.id));
  let customBlocks: HomepageCustomBlock[] | undefined;
  if (input.customBlocks !== undefined) {
    if (!Array.isArray(input.customBlocks) || input.customBlocks.length > 8) return null;
    customBlocks = [];
    for (const value of input.customBlocks) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const block = value as Record<string, unknown>;
      if (typeof block.id !== "string" || !/^custom-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(block.id) || allowed.has(block.id) || (block.type !== "message" && block.type !== "faq" && block.type !== "products")) return null;
      if (typeof block.heading !== "string" || block.heading.length > 100 || typeof block.description !== "string" || block.description.length > 350 || typeof block.buttonText !== "string" || block.buttonText.length > 60 || typeof block.buttonLink !== "string" || (block.buttonLink !== "" && !isSafeHomepageLink(block.buttonLink))) return null;
      if (block.image !== undefined && (typeof block.image !== "string" || (block.image !== "" && !isHomepageImage(block.image)))) return null;
      if (block.imageAlt !== undefined && (typeof block.imageAlt !== "string" || block.imageAlt.length > 160)) return null;
      let style: HomepageMessageStyle | undefined;
      if (block.style !== undefined) {
        if (block.type !== "message" || !block.style || typeof block.style !== "object" || Array.isArray(block.style)) return null;
        const input = block.style as Record<string, unknown>;
        if (!["rose", "ivory", "dark"].includes(input.tone as string) || !["left", "center"].includes(input.alignment as string) || !["left", "right"].includes(input.imagePosition as string)) return null;
        style = { tone: input.tone as HomepageMessageStyle["tone"], alignment: input.alignment as HomepageMessageStyle["alignment"], imagePosition: input.imagePosition as HomepageMessageStyle["imagePosition"] };
      }
      let faqItems: { question: string; answer: string }[] | undefined;
      if (block.type === "faq") {
        if (!Array.isArray(block.faqItems) || block.faqItems.length > 6 || block.image || block.buttonText || block.buttonLink) return null;
        faqItems = [];
        for (const entry of block.faqItems) {
          if (!entry || typeof entry !== "object" || typeof entry.question !== "string" || entry.question.length > 160 || typeof entry.answer !== "string" || entry.answer.length > 600) return null;
          faqItems.push({ question: entry.question, answer: entry.answer });
        }
      } else if (block.faqItems !== undefined) return null;
      let productIds: number[] | undefined;
      if (block.type === "products") {
        if (!Array.isArray(block.productIds) || block.productIds.length > 8 || block.productIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(block.productIds).size !== block.productIds.length || block.image || block.buttonText || block.buttonLink) return null;
        productIds = block.productIds as number[];
      } else if (block.productIds !== undefined) return null;
      allowed.add(block.id);
      customBlocks.push({ id: block.id as `custom-${string}`, type: block.type, heading: block.heading, description: block.description, buttonText: block.buttonText, buttonLink: block.buttonLink, ...(block.image !== undefined ? { image: block.image as string } : {}), ...(block.imageAlt !== undefined ? { imageAlt: block.imageAlt as string } : {}), ...(faqItems ? { faqItems } : {}), ...(productIds ? { productIds } : {}), ...(style ? { style } : {}) });
    }
  }
  if (input.sections.length !== allowed.size || input.sections.some(section => typeof section !== "string" || !allowed.has(section))) return null;
  if (new Set(input.sections).size !== allowed.size) return null;
  const hidden = input.hiddenSections === undefined ? [] : input.hiddenSections;
  if (!Array.isArray(hidden) || hidden.some(section => typeof section !== "string" || !allowed.has(section) || section === "hero") || new Set(hidden).size !== hidden.length) return null;
  const content = input.content === undefined ? undefined : parseHomepageContent(input.content);
  const baseContent = input.baseContent === undefined ? undefined : parseHomepageContent(input.baseContent);
  if (content === null || baseContent === null || Boolean(content) !== Boolean(baseContent)) return null;
  const designBanner = input.designBanner === undefined ? undefined : parseDesignBanner(input.designBanner);
  if (designBanner === null) return null;
  const heroActions = input.heroActions === undefined ? undefined : parseHeroActions(input.heroActions);
  if (heroActions === null) return null;
  const questionsContent = input.questionsContent === undefined ? undefined : parseHomepageQuestions(input.questionsContent);
  if (questionsContent === null) return null;
  if (input.baseStructure !== undefined && (typeof input.baseStructure !== "string" || input.baseStructure.length > 60000)) return null;
  return { version: 1, sections: input.sections as HomepageSectionId[], hiddenSections: hidden as HomepageSectionId[], ...(content && baseContent ? { content, baseContent } : {}), ...(designBanner ? { designBanner } : {}), ...(heroActions ? { heroActions } : {}), ...(questionsContent ? { questionsContent } : {}), ...(customBlocks ? { customBlocks } : {}), ...(input.baseStructure !== undefined ? { baseStructure: input.baseStructure } : {}) };
}
