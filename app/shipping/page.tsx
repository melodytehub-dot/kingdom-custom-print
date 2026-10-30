import Link from "next/link";
import type { Metadata } from "next";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/catalog";
import { formatUSD } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Shipping and returns",
  description:
    "Shipping timelines, costs and our policy on custom printed items.",
};

export default async function ShippingPage() {
  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);

  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Shipping</p>
        <h1 className="display">Shipping and returns</h1>
        <p className="lede">
          Every order is produced after it is placed. The production estimate begins
          after payment and any required artwork review are complete.
        </p>
      </div>

      <div className="wrap section-tight prose">
        <section>
          <h2 className="h3">Turnaround</h2>
          <p>
            Current production estimate: {settings.productionDays}. Artwork review
            happens first; orders requiring changes enter production after those changes are resolved.
          </p>
          <p>
            Hard deadline? Contact us first. Rush options may be available; we'll tell you honestly
            whether we can meet your timeline.
          </p>
        </section>

        <section>
          <h2 className="h3">Shipping</h2>
          <p>
            Shipping is {formatUSD(settings.shippingFlat)} and calculated at
            checkout
            {settings.freeShippingThreshold > 0
              ? `. Orders over ${formatUSD(settings.freeShippingThreshold)} ship free.`
              : "."}
          </p>
          <p>
            <strong>Tracking & updates:</strong> Our team handles shipping personally and provides updates directly. You'll receive your tracking information via email once your order ships.
          </p>
          <p>
            Online checkout currently supports United States delivery only. International
            shipping requires a custom quote — contact us before placing an international order.
          </p>
        </section>

        <section>
          <h2 className="h3">Returns</h2>
          <p>
            Custom printed items are made to your specification. Contact us promptly if
            an item arrives with a print fault, the wrong color, or a manufacturing
            error so the business can review the order and confirm the available remedy.
          </p>
          <p>
            Include your order reference and clear photos of the item. The exact claim
            window and remedy depend on the business policy confirmed for your order.
          </p>
        </section>

        <section>
          <h2 className="h3">Address changes</h2>
          <p>
            An address correction may be possible before production or fulfillment begins,
            but it is not guaranteed. Check your address carefully before paying and
            contact the business immediately if it is wrong.
          </p>
        </section>

        <p className="prose-actions">
          <Link href="/customize" className="btn">
            Start designing
          </Link>
          <Link href="/contact" className="btn btn-ghost">
            Ask a question
          </Link>
        </p>
      </div>
    </>
  );
}
