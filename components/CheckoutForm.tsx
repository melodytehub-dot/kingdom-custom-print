"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Garment from "@/components/Garment";
import ArrowRight from "@/components/icons/ArrowRight";
import { useCart } from "@/lib/cart-context";
import { describeDesign } from "@/lib/types";
import type { SiteSettings } from "@/lib/catalog";

type Fields = {
  email: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  notes: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(fields: Fields): Errors {
  const e: Errors = {};
  if (!EMAIL_RE.test(fields.email.trim())) e.email = "Enter a valid email address.";
  if (fields.name.trim().length < 2) e.name = "Enter the name for this order.";
  if (fields.addressLine1.trim().length < 3) e.addressLine1 = "Enter a street address.";
  if (!fields.city.trim()) e.city = "Enter a city.";
  if (!fields.region.trim()) e.region = "Enter a state or region.";
  if (!fields.postal.trim()) e.postal = "Enter a postal code.";
  if (fields.phone.trim() && !/^[\d\s()+-]{7,}$/.test(fields.phone.trim())) {
    e.phone = "Enter a valid phone number, or leave it blank.";
  }
  return e;
}

export default function CheckoutForm({ settings, paymentsReady }: { settings: SiteSettings; paymentsReady: boolean }) {
  const { items, hydrated, subtotal } = useCart();

  const [fields, setFields] = useState<Fields>({
    email: "",
    name: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postal: "",
    country: "US",
    notes: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const shipping = useMemo(() => {
    if (subtotal <= 0) return 0;
    if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) {
      return 0;
    }
    return settings.shippingFlat;
  }, [subtotal, settings]);

  const total = subtotal + shipping;

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!paymentsReady) {
      setFormError("Card checkout is temporarily unavailable. Your cart is saved.");
      return;
    }

    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, items }),
      });
      const data = (await res.json()) as {
        url?: string;
        reference?: string;
        mode?: string;
        error?: string;
        fieldErrors?: Errors;
      };

      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.error ?? "We could not start checkout.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setFormError("We could not start secure card payment. Your cart is still saved. Please try again.");
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="wrap section">
        <p className="muted" role="status">
          Loading checkout…
        </p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="wrap section">
        <div className="state">
          <h2 className="h3">There is nothing to check out</h2>
          <p>Add a customized garment to your cart first.</p>
          <Link href="/customize" className="btn">
            Start designing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="wrap section-tight checkout" onSubmit={onSubmit} noValidate>
      <div className="checkout-main">
        <h1 className="h2">Checkout</h1>
        {!paymentsReady ? <p className="banner-note" role="status">Card checkout is temporarily unavailable. Your design stays saved in your cart. Please check back soon.</p> : null}

        {formError ? (
          <p className="banner-note is-error" role="alert">
            {formError}
          </p>
        ) : null}

        <fieldset className="field-group">
          <legend className="legend">Contact</legend>
          <div className="field-grid">
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={fields.email}
              onChange={(v) => set("email", v)}
              error={errors.email}
              required
            />
            <TextField
              id="phone"
              label="Phone (optional)"
              type="tel"
              autoComplete="tel"
              value={fields.phone}
              onChange={(v) => set("phone", v)}
              error={errors.phone}
            />
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend className="legend">Shipping address</legend>
          <div className="field-grid">
            <div className="span-2">
              <TextField
                id="name"
                label="Full name"
                autoComplete="name"
                value={fields.name}
                onChange={(v) => set("name", v)}
                error={errors.name}
                required
              />
            </div>
            <div className="span-2">
              <TextField
                id="addressLine1"
                label="Street address"
                autoComplete="address-line1"
                value={fields.addressLine1}
                onChange={(v) => set("addressLine1", v)}
                error={errors.addressLine1}
                required
              />
            </div>
            <div className="span-2">
              <TextField
                id="addressLine2"
                label="Apartment, suite (optional)"
                autoComplete="address-line2"
                value={fields.addressLine2}
                onChange={(v) => set("addressLine2", v)}
              />
            </div>
            <TextField
              id="city"
              label="City"
              autoComplete="address-level2"
              value={fields.city}
              onChange={(v) => set("city", v)}
              error={errors.city}
              required
            />
            <TextField
              id="region"
              label="State / Region"
              autoComplete="address-level1"
              value={fields.region}
              onChange={(v) => set("region", v)}
              error={errors.region}
              required
            />
            <TextField
              id="postal"
              label="Postal code"
              autoComplete="postal-code"
              value={fields.postal}
              onChange={(v) => set("postal", v)}
              error={errors.postal}
              required
            />
            <div className="field">
              <label className="label" htmlFor="country">
                Country
              </label>
              <select
                id="country"
                className="select"
                value={fields.country}
                onChange={(e) => set("country", e.target.value)}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
                <option value="IE">Ireland</option>
              </select>
            </div>
            <div className="field span-2">
              <label className="label" htmlFor="notes">
                Order notes (optional)
              </label>
              <textarea
                id="notes"
                className="textarea"
                rows={3}
                value={fields.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Delivery instructions, print preferences, or a PO number."
              />
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="checkout-side" aria-label="Order summary">
        <div className="panel panel-pad">
          <h2 className="h3">Order summary</h2>

          <ul className="co-items">
            {items.map((item) => (
              <li key={item.id}>
                <div className="co-thumb">
                  {item.previewFront ?? item.previewBack ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(item.previewFront ?? item.previewBack) as string}
                      alt={`${item.productName} in ${item.colorName}`}
                    />
                  ) : (
                    <Garment kind={item.productKind} color={item.colorHex} />
                  )}
                </div>
                <div className="grow">
                  <p className="wrap-anywhere co-name">{item.productName}</p>
                  <p className="small muted co-meta">
                    {item.colorName} · {describeDesign(item.design)} ·{" "}
                    {item.lines
                      .filter((l) => l.qty > 0)
                      .map((l) => `${l.label}×${l.qty}`)
                      .join(", ")}
                  </p>
                </div>
                <p className="tnum co-price">{money(item.total)}</p>
              </li>
            ))}
          </ul>

          <dl className="summary-list">
            <div>
              <dt>Subtotal</dt>
              <dd className="tnum">{money(subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd className="tnum">{shipping === 0 ? "Free" : money(shipping)}</dd>
            </div>
            <div className="summary-total">
              <dt>Total</dt>
              <dd className="tnum">{money(total)}</dd>
            </div>
          </dl>

          <button type="submit" className="btn btn-lg btn-block" disabled={submitting || !paymentsReady}>
            {submitting ? "Starting checkout…" : !paymentsReady ? "Card checkout unavailable" : "Continue to payment"}
            {!submitting ? <ArrowRight /> : null}
          </button>

          <p className="hint">
            Payment is handled by Stripe. Artwork is proofed before anything is printed.
          </p>
        </div>
      </aside>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="req">
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={id}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <span className="error-text" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}