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
        a: "PNG, JPG, WEBP and SVG. Vector files such as SVG print sharpest at any size. For raster artwork, 300 DPI at the finished print size is the target — a design printing 12 inches wide should be at least 3600 × 3600 pixels.",
      },
      {
        q: "Why is there a dashed outline on the garment?",
        a: "That marks the printable area for the side you are viewing. Anything outside it will be cropped in production, so the outline is how you check your artwork will print whole.",
      },
      {
        q: "Can I print on the sleeves?",
        a: "Not through the browser designer, which covers front and back. For sleeve, cuff or collar prints, send the file through the contact form and we will quote it.",
      },
      {
        q: "Will my design be exactly what I see?",
        a: "Yes. What you position in the designer is what we print, within the printable area. We will contact you before production if anything looks like it will not come out cleanly.",
      },
    ],
  },
  {
    title: "Products and pricing",
    items: [
      {
        q: "Is there a minimum order?",
        a: "No. A single garment is printed the same way as a hundred. Price breaks apply automatically as your total rises, so larger runs cost less per garment.",
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
        q: "Can I mix colours in one order?",
        a: "Each design is a separate cart item, so you can order several colourways or designs in one order. Size runs are set per design.",
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
        a: "Yes. The designer saves drafts on your device, and you can reorder the same design later without designing it again.",
      },
    ],
  },
  {
    title: "Orders and shipping",
    items: [
      {
        q: "How long does production take?",
        a: "PRODUCTION_PLACEHOLDER from artwork approval. See the shipping page for rates.",
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
        a: "If it has not entered production we can usually change sizes or cancel. Once printing has started it is too late, so contact us quickly.",
      },
    ],
  },
];

export default async function FaqPage() {
  const settings = await getSettings();

  return (
    <>
      <div className="wrap page-head">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-current="page">FAQ</li>
          </ol>
        </nav>
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
