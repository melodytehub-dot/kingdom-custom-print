import {
  newColumn,
  newId,
  newLayout,
  newSection,
  newWidget,
  type BuilderLayout,
  type SectionNode,
} from "./schema";

export type SectionTemplate = {
  id: string;
  name: string;
  description: string;
  category: "Hero & Banners" | "Storefront" | "Information";
  build: () => SectionNode;
};

export type StarterPageTemplate = {
  id: string;
  name: string;
  description: string;
  defaultTitle: string;
  showTitle: boolean;
  build: () => BuilderLayout;
};

function sectionWithWidget(
  widget: ReturnType<typeof newWidget>,
  options: { boxed?: boolean; paddingTop?: number; paddingBottom?: number; backgroundColor?: string } = {}
): SectionNode {
  const section = newSection();
  section.boxed = options.boxed ?? true;
  section.style = {
    desktop: {
      ...(options.paddingTop !== undefined ? { paddingTop: options.paddingTop } : { paddingTop: 28 }),
      ...(options.paddingBottom !== undefined ? { paddingBottom: options.paddingBottom } : { paddingBottom: 28 }),
      ...(options.backgroundColor ? { backgroundColor: options.backgroundColor } : {}),
    },
  };
  section.columns[0].widgets.push(widget);
  return section;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: "hero-banner",
    name: "Hero banner",
    description: "Full-width photograph banner with headline and two call-to-action buttons.",
    category: "Hero & Banners",
    build: () =>
      sectionWithWidget(newWidget("promo-banner"), {
        boxed: true,
        paddingTop: 24,
        paddingBottom: 24,
      }),
  },
  {
    id: "split-promo",
    name: "Two-column split promo",
    description: "Side-by-side cards for online designing and team or event runs.",
    category: "Hero & Banners",
    build: () => {
      const colLeft = newColumn(50);
      colLeft.widgets.push({
        id: newId(),
        kind: "promo-banner",
        eyebrow: "Print on demand",
        heading: "Design online",
        body: "Upload your artwork or add text in the browser. We print and ship to order.",
        ctaText: "Start designing",
        ctaHref: "/customize",
        secondaryCtaText: "",
        secondaryCtaHref: "",
        imageSrc: "/img/shop-printing.png",
        imageAlt: "Custom artwork printed on apparel",
        overlay: 62,
        minHeight: 320,
        align: "left",
        theme: "dark",
        style: { desktop: { borderRadius: 16 } },
      });

      const colRight = newColumn(50);
      colRight.widgets.push({
        id: newId(),
        kind: "promo-banner",
        eyebrow: "Teams & events",
        heading: "Plan a group order",
        body: "Uniforms, event shirts, and affiliate apparel with quantity breaks.",
        ctaText: "Request a quote",
        ctaHref: "/contact",
        secondaryCtaText: "",
        secondaryCtaHref: "",
        imageSrc: "/img/kingdom-team.webp",
        imageAlt: "People wearing matching Kingdom Custom Print shirts",
        overlay: 62,
        minHeight: 320,
        align: "left",
        theme: "dark",
        style: { desktop: { borderRadius: 16 } },
      });

      return {
        id: newId(),
        kind: "section",
        boxed: true,
        style: { desktop: { paddingTop: 24, paddingBottom: 24, gap: 20 } },
        columns: [colLeft, colRight],
      };
    },
  },
  {
    id: "category-strip",
    name: "Shop by category strip",
    description: "Quick visual category row linking straight to shirts, polos, hoodies, caps, and merch.",
    category: "Storefront",
    build: () => sectionWithWidget(newWidget("category-strip"), { paddingTop: 24, paddingBottom: 24 }),
  },
  {
    id: "featured-products",
    name: "Featured products grid",
    description: "Live catalog cards pulled directly from your active store products.",
    category: "Storefront",
    build: () => sectionWithWidget(newWidget("product-grid"), { paddingTop: 32, paddingBottom: 32 }),
  },
  {
    id: "collections-gallery",
    name: "Collection photo cards",
    description: "Four-column image cards linking to key product collections.",
    category: "Storefront",
    build: () => sectionWithWidget(newWidget("image-gallery"), { paddingTop: 28, paddingBottom: 28 }),
  },
  {
    id: "how-it-works",
    name: "How custom printing works",
    description: "Numbered step-by-step process cards explaining how orders are made.",
    category: "Information",
    build: () =>
      sectionWithWidget(
        {
          id: newId(),
          kind: "feature-cards",
          heading: "How custom printing works",
          subheading: "Choose a blank, customize it in your browser, and review quantities before ordering.",
          columns: 4,
          variant: "steps",
          items: [
            { badge: "01", title: "Choose your blank", body: "Select fabric weight, colors, and print areas for the job." },
            { badge: "02", title: "Design in browser", body: "Upload graphics or arrange text on front and back views." },
            { badge: "03", title: "Set your size run", body: "Enter quantities per size with transparent quantity breaks." },
            { badge: "04", title: "Print and ship", body: "Once payment and artwork are confirmed, we produce and ship." },
          ],
          style: { desktop: {} },
        },
        { paddingTop: 32, paddingBottom: 32, backgroundColor: "#f9f7f4" }
      ),
  },
  {
    id: "store-highlights",
    name: "Store highlights (3 cards)",
    description: "Three clean value cards covering delivery clarity, group runs, and artwork help.",
    category: "Information",
    build: () =>
      sectionWithWidget(
        {
          id: newId(),
          kind: "feature-cards",
          heading: "Your project, our attention to detail",
          subheading: "",
          columns: 3,
          variant: "cards",
          items: [
            { badge: "Delivery", title: "Clear shipping options", body: "Review flat-rate shipping and free shipping thresholds before checkout." },
            { badge: "Orders", title: "Built for custom runs", body: "Custom apparel for teams, businesses, events, and everyday wear." },
            { badge: "Support", title: "Here to help", body: "Questions about artwork files or sizing? Send us your project details." },
          ],
          style: { desktop: {} },
        },
        { paddingTop: 28, paddingBottom: 28 }
      ),
  },
  {
    id: "text-photo-split",
    name: "Text and photo split",
    description: "Two-column 50/50 section with copy and button beside a product studio photo.",
    category: "Information",
    build: () => {
      const copyCol = newColumn(50);
      copyCol.style = { desktop: { columnWidth: 50, verticalAlign: "center", gap: 12 } };
      copyCol.widgets.push(
        {
          id: newId(),
          kind: "heading",
          text: "Made for teams, events and everyday wear",
          level: 2,
          style: { desktop: { fontSize: 34, fontWeight: 700, lineHeight: 1.15 } },
        },
        {
          id: newId(),
          kind: "text",
          text: "Start with any blank in the catalog, add your logo or lettering, and preview placement on both sides before placing your order.",
          style: { desktop: { fontSize: 16, lineHeight: 1.65, textColor: "#5a5753" } },
        },
        {
          id: newId(),
          kind: "button",
          text: "Open design studio",
          href: "/customize",
          variant: "solid",
          style: { desktop: { marginTop: 8 } },
        }
      );

      const photoCol = newColumn(50);
      photoCol.widgets.push({
        id: newId(),
        kind: "image",
        src: "/img/shop-studio.png",
        alt: "Kingdom Custom Print studio sample shirt",
        href: "/shop",
        style: { desktop: { aspectRatio: 1.25, objectFit: "cover", borderRadius: 14 } },
      });

      return {
        id: newId(),
        kind: "section",
        boxed: true,
        style: { desktop: { paddingTop: 32, paddingBottom: 32, gap: 28 } },
        columns: [copyCol, photoCol],
      };
    },
  },
  {
    id: "faq-section",
    name: "Common questions",
    description: "Expandable FAQ accordion with a clear section heading.",
    category: "Information",
    build: () => {
      const section = newSection();
      section.style = { desktop: { paddingTop: 28, paddingBottom: 28 } };
      section.columns[0].style = { desktop: { columnWidth: 100, gap: 14 } };
      section.columns[0].widgets.push(
        {
          id: newId(),
          kind: "heading",
          text: "Common questions",
          level: 2,
          style: { desktop: { fontSize: 30, fontWeight: 700, lineHeight: 1.15 } },
        },
        {
          id: newId(),
          kind: "faq",
          items: [
            { question: "What artwork files can I upload?", answer: "PNG, JPG, WebP, HEIC, AVIF, GIF and SVG files are supported in the design studio." },
            { question: "Is there a minimum order?", answer: "No. Quantity breaks apply per configured product in your cart." },
            { question: "Can I print on both front and back?", answer: "Yes. Switch between Front and Back views in the design studio to customize both sides." },
          ],
          style: { desktop: {} },
        }
      );
      return section;
    },
  },
  {
    id: "contact-inquiry",
    name: "Contact form & details",
    description: "Live storefront inquiry form alongside your published contact details.",
    category: "Information",
    build: () => sectionWithWidget(newWidget("contact-block"), { paddingTop: 28, paddingBottom: 28 }),
  },
];

export const STARTER_PAGE_TEMPLATES: StarterPageTemplate[] = [
  {
    id: "blank",
    name: "Blank page",
    description: "Start fresh with one empty section ready for your own blocks.",
    defaultTitle: "",
    showTitle: true,
    build: () => newLayout(),
  },
  {
    id: "team-orders",
    name: "Team & group orders",
    description: "A landing page for sports teams, events, and bulk apparel runs.",
    defaultTitle: "Team & Group Orders",
    showTitle: false,
    build: () => ({
      version: 1,
      sections: [
        sectionWithWidget(
          {
            id: newId(),
            kind: "promo-banner",
            eyebrow: "Group orders",
            heading: "Custom apparel for your team or event.",
            body: "Mix sizes in one order with quantity-break pricing, or reach out for help planning a larger run.",
            ctaText: "Start designing",
            ctaHref: "/customize",
            secondaryCtaText: "Request a quote",
            secondaryCtaHref: "/contact",
            imageSrc: "/img/kingdom-team.webp",
            imageAlt: "Group wearing matching custom printed shirts",
            overlay: 62,
            minHeight: 400,
            align: "left",
            theme: "dark",
            style: { desktop: { borderRadius: 16 } },
          },
          { paddingTop: 20, paddingBottom: 20 }
        ),
        SECTION_TEMPLATES.find((t) => t.id === "how-it-works")!.build(),
        SECTION_TEMPLATES.find((t) => t.id === "featured-products")!.build(),
        SECTION_TEMPLATES.find((t) => t.id === "contact-inquiry")!.build(),
      ],
    }),
  },
  {
    id: "collections-showcase",
    name: "Collections & merch showcase",
    description: "Highlight product categories, featured blanks, and storefront collections.",
    defaultTitle: "Custom Collections",
    showTitle: false,
    build: () => ({
      version: 1,
      sections: [
        SECTION_TEMPLATES.find((t) => t.id === "hero-banner")!.build(),
        SECTION_TEMPLATES.find((t) => t.id === "category-strip")!.build(),
        SECTION_TEMPLATES.find((t) => t.id === "featured-products")!.build(),
        SECTION_TEMPLATES.find((t) => t.id === "collections-gallery")!.build(),
      ],
    }),
  },
  {
    id: "sizing-guide",
    name: "Sizing & artwork guide",
    description: "Helpful preparation checklist and FAQs before customers design.",
    defaultTitle: "Artwork & Sizing Guide",
    showTitle: true,
    build: () => ({
      version: 1,
      sections: [
        SECTION_TEMPLATES.find((t) => t.id === "text-photo-split")!.build(),
        SECTION_TEMPLATES.find((t) => t.id === "faq-section")!.build(),
      ],
    }),
  },
];
