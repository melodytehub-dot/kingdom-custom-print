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
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-current="page">Shipping</li>
          </ol>
        </nav>
        <p className="eyebrow">Shipping</p>
        <h1 className="display">Shipping and returns</h1>
        <p className="lede">
          Every order is printed after you order it, so turnaround runs from artwork
          approval rather than from the day you check out.
        </p>
      </div>

      <div className="wrap section-tight prose">
        <section>
          <h2 className="h3">Turnaround</h2>
          <p>
            Production takes {settings.productionDays}. Artwork review happens first —
            if we need to change something we will contact you, and the clock starts
            from your approval.
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
            We ship within the United States and to the countries listed at checkout.
            Duties and import taxes for international orders are the recipient&rsquo;s
            responsibility.
          </p>
        </section>

        <section>
          <h2 className="h3">Returns</h2>
          <p>
            Custom printed items are made to your specification, so they cannot be
            returned for change of mind. That said, if something arrives with a print
            fault, the wrong colour or a manufacturing error, contact us and we will put
            it right — reprinting or refunding as appropriate.
          </p>
          <p>
            Report any issue within 14 days of delivery and include your order reference
            and a photo of the item.
          </p>
        </section>

        <section>
          <h2 className="h3">Address changes</h2>
          <p>
            If an order has not entered production yet we can usually redirect it. Once
            printing has started we cannot change the destination, so please check your
            address carefully before confirming.
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
