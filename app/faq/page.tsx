import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Answers on artwork files, print areas, sizing, minimums, production time and shipping for custom printed apparel.",
};

const GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Artwork",
    items: [
      {
        q: "What file types can I upload?",
        a: "PNG, JPG, WebP, HEIC, AVIF, GIF and SVG. The browser optimizes raster uploads for an on-screen placement proof, so keep your original high-resolution file. SVG stays sharpest; production staff must verify source quality before printing.",
      },
      {
        q: "Why is there a dashed outline on the garment?",
        a: "That marks the configured printable area for the side you are viewing. Keep artwork inside it. The screen is a placement proof; production staff must still verify the blank, dimensions and source file before printing.",
      },
      {
        q: "Can I print on the sleeves?",
        a: "Not through the browser designer, which covers front and back. For sleeve, cuff or collar prints, send the file through the contact form and we will quote it.",
      },
      {
        q: "Will my design be exactly what I see?",
        a: "The designer records side, position, scale and rotation for the customer proof. Screens, garment photography and print methods vary, so it is not a press-ready color or resolution guarantee. Production staff review the saved proof and source artwork before printing.",
      },
    ],
  },
  {
    title: "Products and pricing",
    items: [
      {
        q: "Is there a minimum order?",
        a: "No. Price breaks apply to the quantity of each product configuration in the cart, so larger runs of the same configured item cost less per garment.",
      },
      {
        q: "Why is the price different on some products?",
        a: "Blank cost, fabric weight and decoration time all differ. Heavier garments cost more, and larger print areas take longer. Each product page lists the fabric and per-side print charge.",
      },
      {
        q: "What are the extended size charges?",
        a: "2XL and above carry a surcharge because the blanks cost more to produce. The exact amount is shown next to each size on the product page and in the designer.",
      },
      {
        q: "Can I mix colors in one order?",
        a: "Each design is a separate cart item, so you can order several colorways or designs in one order. Size runs are set per design.",
      },
    ],
  },
  {
    title: "Sizing",
    items: [
      {
        q: "How do I pick the right size?",
        a: "The sizes offered for each blank are listed on its product page. Measure a garment you already own flat, across the chest and length, and compare it against how that one fits. Cotton shrinks a little in the wash, so sizing up is reasonable if you are between sizes. Contact us if you want garment measurements before you order.",
      },
      {
        q: "What if people have different sizes?",
        a: "That is what the size run is for. Enter the quantity against each size and the price updates for the total. Bulk orders are priced on the garment count, not per size.",
      },
      {
        q: "Can I order a size run to keep?",
        a: "The designer saves drafts on this device. Account orders remain visible while the account is available, but a one-click reorder workflow has not been added yet.",
      },
    ],
  },
  {
    title: "Orders and shipping",
    items: [
      {
        q: "How long does production take?",
        a: "PRODUCTION_PLACEHOLDER. See the shipping page for rates.",
      },
      {
        q: "Can I get a rush order?",
        a: "Sometimes. Send us the quantity, deadline and artwork through the contact form and we will tell you what is realistic.",
      },
      {
        q: "What happens after I order?",
        a: "We review your artwork, contact you if anything needs changing, print once you approve, then ship. Your order page shows where it is at each stage.",
      },
      {
        q: "Can I change my order after placing it?",
        a: "Contact us immediately. A size change or cancellation may be possible before production begins, but it is not guaranteed and cannot be made after printing starts.",
      },
    ],
  },
];

export default async function FaqPage() {
  const settings = await getSettings();

  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">FAQ</p>
        <h1 className="display">Questions, answered</h1>
        <p className="lede">
          The things people ask most about artwork, sizing and production.
        </p>
      </div>

      <div className="wrap section-tight">
        {GROUPS.map((group) => (
          <section key={group.title} className="faq-group">
            <h2 className="h3">{group.title}</h2>
            <dl className="faq">
              {group.items.map((item) => (
                <div key={item.q} className="faq-item">
                  <dt>{item.q.replace("PRODUCTION_PLACEHOLDER", settings.productionDays)}</dt>
                  <dd>{item.a.replace("PRODUCTION_PLACEHOLDER", settings.productionDays)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <div className="cta-row">
          <Link href="/customize" className="btn btn-lg">
            Start designing
          </Link>
          <Link href="/contact" className="btn btn-lg btn-ghost">
            Ask something else
          </Link>
        </div>
      </div>
    </>
  );
}
