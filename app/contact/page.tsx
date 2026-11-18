import Link from "next/link";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import BuilderPageView from "@/components/builder/BuilderPageView";
import { readPublishedBuilderPage } from "@/lib/builder/store";
import { getProducts, getSettings, DEFAULT_SETTINGS } from "@/lib/catalog";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

const DEFAULT_META: Metadata = {
  title: "Contact",
  description:
    "Questions about artwork, sizing or a bulk run? Find the business contact options currently available.",
};

export async function generateMetadata(): Promise<Metadata> {
  const custom = await readPublishedBuilderPage("contact");
  if (!custom) return DEFAULT_META;
  return {
    title: custom.title,
    description: custom.description || DEFAULT_META.description,
  };
}

export default async function ContactPage() {
  const [custom, settings] = await Promise.all([
    readPublishedBuilderPage("contact"),
    getSettings().catch(() => DEFAULT_SETTINGS),
  ]);
  const contactEmail = process.env.SUPPORT_EMAIL?.trim() || settings.contactEmail;
  const canSend = emailConfigured() && Boolean(process.env.SUPPORT_EMAIL);

  if (custom) {
    const products = await getProducts().catch(() => []);
    return (
      <BuilderPageView
        page={custom}
        products={products}
        settings={{ ...settings, contactEmail }}
        canSendEmail={canSend}
      />
    );
  }

  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Contact</p>
        <h1 className="display">Talk to us</h1>
        <p className="lede">
          Questions about artwork, sizing or a bulk run are welcome. Tell us what you are
          printing and roughly when you need it.
        </p>
      </div>

      <div className="wrap section-tight contact-layout">
        <div>
          <ContactForm contactEmail={contactEmail} canSend={canSend} />
        </div>

        <aside className="contact-side" aria-label="Contact details">
          <div className="panel panel-pad">
            <h2 className="h3">Direct</h2>
            <dl className="contact-list">
              {contactEmail ? (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                  </dd>
                </div>
              ) : null}
              {settings.contactPhone ? (
                <div>
                  <dt>Phone</dt>
                  <dd>{settings.contactPhone}</dd>
                </div>
              ) : null}
              {settings.businessAddress ? (
                <div>
                  <dt>Address</dt>
                  <dd>{settings.businessAddress}</dd>
                </div>
              ) : null}
              <div>
                <dt>Production time</dt>
                <dd>{settings.productionDays}</dd>
              </div>
            </dl>

            {!contactEmail && !settings.contactPhone ? (
              <p className="hint">
                Contact details are published once the business sets them in the admin
                dashboard.
              </p>
            ) : null}
          </div>

          <div className="panel panel-pad">
            <h2 className="h3">Faster answers</h2>
            <ul className="quick-links">
              <li>
                <Link href="/faq">Frequently asked questions</Link>
              </li>
              <li>
                <Link href="/shipping">Shipping and returns</Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
