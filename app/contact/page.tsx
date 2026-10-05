import Link from "next/link";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about artwork, sizing or a bulk run? Send us the details and we will come back to you.",
};

export default async function ContactPage() {
  const settings = await getSettings();

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
          <ContactForm contactEmail={settings.contactEmail} />
        </div>

        <aside className="contact-side" aria-label="Contact details">
          <div className="panel panel-pad">
            <h2 className="h3">Direct</h2>
            <dl className="contact-list">
              {settings.contactEmail ? (
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
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

            {!settings.contactEmail && !settings.contactPhone ? (
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
