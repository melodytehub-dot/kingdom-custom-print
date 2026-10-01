import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How we handle the information you share when placing a custom print order.",
};

export default async function PrivacyPage() {
  const settings = await getSettings();
  const updated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <div className="wrap page-head">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-current="page">Privacy</li>
          </ol>
        </nav>
        <p className="eyebrow">Legal</p>
        <h1 className="display">Privacy policy</h1>
        <p className="lede">Last updated {updated}</p>
      </div>

      <div className="wrap section-tight prose">
        <section>
          <h2 className="h3">What we collect</h2>
          <p>
            When you place an order we collect the contact, shipping and billing details
            needed to print and deliver it: your name, email address, phone number,
            delivery address and the contents of your design. Payment card details are
            handled by our payment provider and never reach our servers.
          </p>
          <p>
            Artwork you upload is stored with your order so we can print it and so you
            can reorder. Designs saved in the browser are kept on your own device until
            you clear them.
          </p>
        </section>

        <section>
          <h2 className="h3">How we use it</h2>
          <p>
            We use this information to produce your order, contact you about artwork or
            delivery, and provide support. We do not sell it, and we do not share it with
            third parties for their own marketing.
          </p>
        </section>

        <section>
          <h2 className="h3">Payments</h2>
          <p>
            Payments are processed by a third-party payment provider. They receive the
            amount, currency and order reference, and handle your card details under
            their own privacy policy.
          </p>
        </section>

        <section>
          <h2 className="h3">Retention</h2>
          <p>
            Order records are kept as long as needed to fulfil the order and to handle
            any later question about it. If you want your data removed, contact us and we
            will deal with it.
          </p>
        </section>

        <section>
          <h2 className="h3">Your rights</h2>
          <p>
            You can ask for a copy of the information we hold about you, or ask us to
            correct or delete it. Contact us using the details below and we will respond.
          </p>
          {settings.contactEmail ? (
            <p>
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="h3">Cookies</h2>
          <p>
            This site stores your cart, your saved designs and your admin session in your
            browser&rsquo;s local storage and cookies. No advertising or tracking cookies
            are set.
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
