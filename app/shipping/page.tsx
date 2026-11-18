import Link from "next/link";
import type { Metadata } from "next";
import BuilderPageView from "@/components/builder/BuilderPageView";
import { readPublishedBuilderPage } from "@/lib/builder/store";
import { getProducts, getSettings, DEFAULT_SETTINGS } from "@/lib/catalog";
import { emailConfigured } from "@/lib/email";
import { formatUSD } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const DEFAULT_META: Metadata = {
  title: "Shipping and returns",
  description:
    "Shipping timelines, costs and our policy on custom printed items.",
};

export async function generateMetadata(): Promise<Metadata> {
  const custom = await readPublishedBuilderPage("shipping");
  if (!custom) return DEFAULT_META;
  return {
    title: custom.title,
    description: custom.description || DEFAULT_META.description,
  };
}

export default async function ShippingPage() {
  const [custom, settings] = await Promise.all([
    readPublishedBuilderPage("shipping"),
    getSettings().catch(() => DEFAULT_SETTINGS),
  ]);

  if (custom) {
    const products = await getProducts().catch(() => []);
    const contactEmail = process.env.SUPPORT_EMAIL?.trim() || settings.contactEmail;
    return (
      <BuilderPageView
        page={custom}
        products={products}
        settings={{ ...settings, contactEmail }}
        canSendEmail={emailConfigured() && Boolean(process.env.SUPPORT_EMAIL)}
      />
    );
  }

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
            Hard deadline? Contact us first. Rush options may be available; we&apos;ll tell you honestly
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
            <strong>Shipping updates:</strong> Our team handles shipping personally. Contact us if you have questions about your order.
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
