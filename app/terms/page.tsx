import Link from "next/link";
import type { Metadata } from "next";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "The terms that apply when ordering custom printed apparel.",
};

export default async function TermsPage() {
  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  const updated = "October 25, 2026";

  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Legal</p>
        <h1 className="display">Terms and conditions</h1>
        <p className="lede">Last updated {updated}</p>
      </div>

      <div className="wrap section-tight prose">
        <section>
          <h2 className="h3">Orders</h2>
          <p>
            An order is accepted once payment clears and artwork has been approved.
            Production begins at that point and takes {settings.productionDays}.
          </p>
        </section>

        <section>
          <h2 className="h3">Artwork responsibility</h2>
          <p>
            You confirm you have the right to print the artwork you supply, including
            any logos, photographs or typefaces. We are not responsible for orders printed
            from material that infringes someone else&rsquo;s rights.
          </p>
          <p>
            We check files for technical printability, not for ownership. If artwork
            cannot be printed as submitted we will contact you; if you approve a change
            and it prints differently from what you expected, we work from what is
            approved.
          </p>
        </section>

        <section>
          <h2 className="h3">Color and material</h2>
          <p>
            Colors shown on screen are a representation. Garment dye lots and screen
            settings vary, so a printed garment may differ slightly from the on-screen
            preview. Fabric weight and composition are as stated on each product page.
          </p>
        </section>

        <section>
          <h2 className="h3">Pricing</h2>
          <p>
            Prices are in US dollars. Quantity breaks are calculated separately for each
            product configuration in the cart, matching the price shown in the designer
            and checkout. We may correct obvious pricing errors before production and
            will contact you if that affects your order.
          </p>
        </section>

        <section>
          <h2 className="h3">Custom goods</h2>
          <p>
            Custom printed items are made to the approved specification. Contact the
            business promptly about a fault, manufacturing error, or incorrect item so
            it can review the order and confirm the remedy available under its policy.
          </p>
        </section>

        <section>
          <h2 className="h3">Liability</h2>
          <p>
            Our liability for any order is limited to the amount paid for it. Nothing in
            these terms limits liability for death, personal injury or fraud.
          </p>
        </section>

        <p className="prose-actions">
          <Link href="/contact" className="btn">
            Contact us
          </Link>
        </p>
      </div>
    </>
  );
}
