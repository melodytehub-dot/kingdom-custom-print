import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "How custom printing works",
  description:
    "How we print custom apparel to order: pick a blank, add artwork, confirm your size run, and we print once artwork is approved.",
};

const STAGES = [
  {
    step: "01",
    title: "Choose the blank",
    body: "Every garment page lists the fabric weight, available colors and the printable area for each side. Pick what suits the job — a chest mark, a full front, or a large back print.",
  },
  {
    step: "02",
    title: "Add artwork in the browser",
    body: "Type text directly, or upload supported artwork. Drag it into position, resize with the handles, rotate if needed, and switch between front and back. The dashed outline is a placement guide for the customer proof, not a press-ready resolution guarantee.",
  },
  {
    step: "03",
    title: "Set the size run",
    body: "Enter quantities per size rather than one flat total. Pricing updates per garment as the total crosses quantity breaks, and extended sizes carry their own surcharge where applicable.",
  },
  {
    step: "04",
    title: "We check the file",
    body: "Before anything goes to press, production staff should compare both saved proof sides, placement and available source artwork. The original high-resolution file may still be required for a clean print.",
  },
  {
    step: "05",
    title: "Print and ship",
    body: "Once artwork is approved and Stripe confirms payment, the order can enter production. The private order page shows Shipped after the production team records dispatch.",
  },
];

const FAQ_LINKS = [
  {
    q: "What artwork should I upload?",
    a: "SVG is the best browser upload when available. Raster and phone photos are optimized for the placement proof, so keep the original high-resolution file for production review.",
  },
  {
    q: "Can I print on both sides?",
    a: "Yes. Each garment has separate printable areas for the front and back, and the designer lets you place different artwork on each side. The print charge is applied per printed side.",
  },
  {
    q: "Is there a minimum order?",
    a: "No. Quantity breaks apply separately to each product configuration, and the designer and checkout show the resulting per-garment price.",
  },
  {
    q: "How do I know my size run is right?",
    a: "Each product page lists the sizes that blank is made in. Measure a garment you already own and compare it against how that one fits rather than guessing from the label alone. If you are ordering for a group, ask each person for their usual size.",
  },
];

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">How it works</p>
        <h1 className="display">
          From your file
          <br />
          to the finished run
        </h1>
        <p className="lede">
          We print custom apparel to order. Nothing is made until it is ordered, and
          nothing is printed until the artwork is right. Production takes{" "}
          {settings.productionDays}.
        </p>
      </div>

      <section className="section-tight">
        <div className="wrap">
          <ol className="process">
            {STAGES.map((s) => (
              <li key={s.step} className="process-step">
                <span className="process-n tnum" aria-hidden="true">
                  {s.step}
                </span>
                <div className="process-body">
                  <h2 className="h3">{s.title}</h2>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Common questions</p>
              <h2 className="h2">Before you order</h2>
            </div>
          </div>

          <dl className="faq">
            {FAQ_LINKS.map((f) => (
              <div key={f.q} className="faq-item">
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>

          <div className="cta-row">
            <Link href="/customize" className="btn btn-lg">
              Start designing
            </Link>
            <Link href="/faq" className="btn btn-lg btn-ghost">
              More questions
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
