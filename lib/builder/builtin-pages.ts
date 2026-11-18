import type { SiteSettings } from "@/lib/catalog-types";
import { formatUSD } from "@/lib/pricing";
import {
  newId,
  type BuilderLayout,
  type BuilderPage,
  type EditableStoreSlug,
  type SectionNode,
} from "./schema";

export type StorePageDescriptor = {
  slug: EditableStoreSlug;
  title: string;
  description: string;
  path: string;
};

export const STORE_PAGE_CATALOG: StorePageDescriptor[] = [
  {
    slug: "about",
    title: "How custom printing works",
    description: "How we print custom apparel to order: pick a blank, add artwork, confirm your size run, and review before ordering.",
    path: "/about",
  },
  {
    slug: "faq",
    title: "Frequently asked questions",
    description: "Answers on artwork files, print areas, sizing, minimums, production time and shipping for custom printed apparel.",
    path: "/faq",
  },
  {
    slug: "shipping",
    title: "Shipping and returns",
    description: "Shipping timelines, costs and our policy on custom printed items.",
    path: "/shipping",
  },
  {
    slug: "contact",
    title: "Contact",
    description: "Questions about artwork, sizing or a bulk run? Send us a message or check our published store details.",
    path: "/contact",
  },
];

function wrapSection(widgets: SectionNode["columns"][number]["widgets"], paddingTop = 20, paddingBottom = 20): SectionNode {
  return {
    id: newId(),
    kind: "section",
    boxed: true,
    style: { desktop: { paddingTop, paddingBottom } },
    columns: [
      {
        id: newId(),
        kind: "column",
        style: { desktop: { columnWidth: 100, gap: 12 } },
        widgets,
      },
    ],
  };
}

function buildAboutLayout(): BuilderLayout {
  return {
    version: 1,
    sections: [
      wrapSection([
        {
          id: newId(),
          kind: "feature-cards",
          heading: "From your file to the finished run",
          subheading: "Create custom apparel for your team, event, or everyday wear. Production takes 7-10 business days.",
          columns: 2,
          variant: "steps",
          items: [
            {
              badge: "01",
              title: "Choose the blank",
              body: "Every garment page lists the fabric weight, available colors and the printable area for each side. Pick what suits the job — a chest mark, a full front, or a large back print.",
            },
            {
              badge: "02",
              title: "Add artwork in the browser",
              body: "Type text directly, or upload supported artwork. Drag it into position, resize with the handles, rotate if needed, and switch between front and back.",
            },
            {
              badge: "03",
              title: "Set the size run",
              body: "Enter quantities per size rather than one flat total. Pricing updates per garment as the total crosses quantity breaks, and extended sizes carry their own surcharge where applicable.",
            },
            {
              badge: "04",
              title: "We check the file",
              body: "For the best print, upload a clear, high-resolution image and review its placement before ordering.",
            },
            {
              badge: "05",
              title: "Print and ship",
              body: "Once payment is confirmed, your order can enter production. Contact us if you have questions about your order.",
            },
          ],
          style: { desktop: {} },
        },
      ]),
      wrapSection([
        {
          id: newId(),
          kind: "heading",
          text: "Before you order",
          level: 2,
          style: { desktop: { fontSize: 32, fontWeight: 700, lineHeight: 1.15 } },
        },
        {
          id: newId(),
          kind: "faq",
          items: [
            {
              question: "What artwork should I upload?",
              answer: "SVG is the best browser upload when available. Raster and phone photos are optimized for the placement proof, so keep the original high-resolution file for production review.",
            },
            {
              question: "Can I print on both sides?",
              answer: "Yes. Each garment has separate printable areas for the front and back, and the designer lets you place different artwork on each side. The print charge is applied per printed side.",
            },
            {
              question: "Is there a minimum order?",
              answer: "No. Quantity breaks apply separately to each product configuration, and the designer and checkout show the resulting per-garment price.",
            },
            {
              question: "How do I know my size run is right?",
              answer: "Each product page lists the sizes that blank is made in. Measure a garment you already own and compare it against how that one fits rather than guessing from the label alone.",
            },
          ],
          style: { desktop: {} },
        },
        {
          id: newId(),
          kind: "button",
          text: "Start designing",
          href: "/customize",
          variant: "solid",
          style: { desktop: { marginTop: 8 } },
        },
      ]),
    ],
  };
}

function buildFaqLayout(): BuilderLayout {
  const groups: { title: string; items: { question: string; answer: string }[] }[] = [
    {
      title: "Artwork",
      items: [
        {
          question: "What file types can I upload?",
          answer: "You can upload PNG, JPG, WebP, HEIC, AVIF, GIF, or SVG. Keep your original high-resolution file for the best print quality.",
        },
        {
          question: "Why is there a dashed outline on the garment?",
          answer: "It marks the printable area for the side you're viewing. Keep your artwork inside the outline.",
        },
        {
          question: "Can I print on the sleeves?",
          answer: "Not through the browser designer, which covers front and back. For sleeve, cuff or collar prints, send the file through the contact form and we will quote it.",
        },
        {
          question: "Will my design be exactly what I see?",
          answer: "The preview shows your artwork's placement. Colors and detail may vary between your screen and the finished print.",
        },
      ],
    },
    {
      title: "Products and pricing",
      items: [
        {
          question: "Is there a minimum order?",
          answer: "No. Price breaks apply to the quantity of each product configuration in the cart, so larger runs of the same configured item cost less per garment.",
        },
        {
          question: "Why is the price different on some products?",
          answer: "Blank cost, fabric weight and decoration time all differ. Heavier garments cost more, and larger print areas take longer. Each product page lists the fabric and per-side print charge.",
        },
        {
          question: "What are the extended size charges?",
          answer: "2XL and above carry a surcharge because the blanks cost more to produce. The exact amount is shown next to each size on the product page and in the designer.",
        },
        {
          question: "Can I mix colors in one order?",
          answer: "Each design is a separate cart item, so you can order several colorways or designs in one order. Size runs are set per design.",
        },
      ],
    },
    {
      title: "Sizing",
      items: [
        {
          question: "How do I pick the right size?",
          answer: "The sizes offered for each blank are listed on its product page. Measure a garment you already own flat, across the chest and length, and compare it against how that one fits.",
        },
        {
          question: "What if people have different sizes?",
          answer: "That is what the size run is for. Enter the quantity against each size and the price updates for the total. Bulk orders are priced on the garment count, not per size.",
        },
      ],
    },
    {
      title: "Orders and shipping",
      items: [
        {
          question: "How long does production take?",
          answer: "Production typically takes 7-10 business days after your order is confirmed. Rush options may be available — contact us with your deadline and details.",
        },
        {
          question: "How will I know when my order ships?",
          answer: "You'll receive an email with tracking information once your order ships. Our team handles all shipping personally.",
        },
        {
          question: "Can I change my order after placing it?",
          answer: "Contact us immediately. A size change or cancellation may be possible before production begins, but it is not guaranteed and cannot be made after printing starts.",
        },
      ],
    },
  ];

  return {
    version: 1,
    sections: [
      ...groups.map((group) =>
        wrapSection([
          {
            id: newId(),
            kind: "heading",
            text: group.title,
            level: 2,
            style: { desktop: { fontSize: 26, fontWeight: 700, lineHeight: 1.2 } },
          },
          {
            id: newId(),
            kind: "faq",
            items: group.items,
            style: { desktop: {} },
          },
        ])
      ),
      wrapSection([
        {
          id: newId(),
          kind: "button",
          text: "Start designing",
          href: "/customize",
          variant: "solid",
          style: { desktop: {} },
        },
      ]),
    ],
  };
}

function buildShippingLayout(settings: SiteSettings): BuilderLayout {
  const shippingSummary =
    settings.freeShippingThreshold > 0
      ? `Shipping is ${formatUSD(settings.shippingFlat)} and calculated at checkout. Orders over ${formatUSD(settings.freeShippingThreshold)} ship free.`
      : `Shipping is ${formatUSD(settings.shippingFlat)} and calculated at checkout.`;

  return {
    version: 1,
    sections: [
      wrapSection([
        {
          id: newId(),
          kind: "heading",
          text: "Turnaround",
          level: 2,
          style: { desktop: { fontSize: 26, fontWeight: 700 } },
        },
        {
          id: newId(),
          kind: "text",
          text: `Current production estimate: ${settings.productionDays}. Artwork review happens first; orders requiring changes enter production after those changes are resolved.\n\nHard deadline? Contact us first. Rush options may be available; we'll tell you honestly whether we can meet your timeline.`,
          style: { desktop: { fontSize: 16, lineHeight: 1.65 } },
        },
        { id: newId(), kind: "divider", style: { desktop: { marginTop: 12, marginBottom: 12 } } },
        {
          id: newId(),
          kind: "heading",
          text: "Shipping",
          level: 2,
          style: { desktop: { fontSize: 26, fontWeight: 700 } },
        },
        {
          id: newId(),
          kind: "text",
          text: `${shippingSummary}\n\nOnline checkout currently supports United States delivery only. International shipping requires a custom quote — contact us before placing an international order.`,
          style: { desktop: { fontSize: 16, lineHeight: 1.65 } },
        },
        { id: newId(), kind: "divider", style: { desktop: { marginTop: 12, marginBottom: 12 } } },
        {
          id: newId(),
          kind: "heading",
          text: "Returns & address changes",
          level: 2,
          style: { desktop: { fontSize: 26, fontWeight: 700 } },
        },
        {
          id: newId(),
          kind: "text",
          text: "Custom printed items are made to your specification. Contact us promptly with your order reference and clear photos if an item arrives with a print fault, the wrong color, or a manufacturing error.\n\nAn address correction may be possible before production or fulfillment begins, but it is not guaranteed. Check your address carefully before paying and contact us immediately if it is wrong.",
          style: { desktop: { fontSize: 16, lineHeight: 1.65 } },
        },
        {
          id: newId(),
          kind: "button",
          text: "Start designing",
          href: "/customize",
          variant: "solid",
          style: { desktop: { marginTop: 12 } },
        },
      ]),
    ],
  };
}

function buildContactLayout(): BuilderLayout {
  return {
    version: 1,
    sections: [
      wrapSection([
        {
          id: newId(),
          kind: "contact-block",
          heading: "Talk to us",
          body: "Questions about artwork, sizing or a bulk run are welcome. Tell us what you are printing and roughly when you need it.",
          showDetails: true,
          showQuickLinks: true,
          style: { desktop: {} },
        },
      ]),
    ],
  };
}

export function createBuiltinStarterPage(slug: EditableStoreSlug, settings: SiteSettings): BuilderPage {
  const meta = STORE_PAGE_CATALOG.find((entry) => entry.slug === slug);
  const layout =
    slug === "about"
      ? buildAboutLayout()
      : slug === "faq"
        ? buildFaqLayout()
        : slug === "shipping"
          ? buildShippingLayout(settings)
          : buildContactLayout();

  return {
    slug,
    title: meta?.title ?? slug,
    description: meta?.description ?? "",
    showTitle: slug !== "contact",
    layout,
    updatedAt: new Date().toISOString(),
  };
}
