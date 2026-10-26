import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/catalog";
import { formatUSD } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Shipping and returns",
  description:
    "Shipping timelines, costs and our policy on custom printed items.",
};

export default async function ShippingPage() {
  const settings = await getSettings();

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
            The current production estimate is {settings.productionDays}. Artwork review
            happens first; an order that needs changes does not enter production until
            those changes are resolved.
          </p>
          <p>
            If you have a hard deadline, mention it when you order or send us a message
            first. Rush options can sometimes be accommodated; we will tell you honestly
            whether it is possible.
          </p>
        </section>

        <section>
          <h2 className="h3">Rates</h2>
          <p>
            Standard shipping is {formatUSD(settings.shippingFlat)} and is calculated at
            checkout
            {settings.freeShippingThreshold > 0
              ? `. Orders over ${formatUSD(settings.freeShippingThreshold)} ship free.`
              : "."}
          </p>
          <p>
            Online checkout currently supports United States delivery only. International
            rates, duties, taxes, and delivery times are not built into this flat rate;
            contact us for a quote before placing an international order.
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
