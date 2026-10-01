"use client";

import { useState } from "react";
import Link from "next/link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ContactForm({
  contactEmail,
}: {
  contactEmail: string;
}) {
  const [fields, setFields] = useState({
    name: "",
    email: "",
    orderReference: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const found: Record<string, string> = {};
    if (fields.name.trim().length < 2) found.name = "Enter your name.";
    if (!EMAIL_RE.test(fields.email.trim())) found.email = "Enter a valid email address.";
    if (fields.message.trim().length < 10) {
      found.message = "Tell us a little more so we can help.";
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    if (!contactEmail) {
      setState({
        tone: "error",
        text: "Email is not set up on this site yet. Please check back shortly.",
      });
      return;
    }

    setBusy(true);
    setState(null);
    // Opens the visitor's mail client so the enquiry reaches the business inbox.
    const subject = fields.orderReference
      ? `Order enquiry ${fields.orderReference}`
      : "Custom printing enquiry";
    const body = [
      `Name: ${fields.name}`,
      `Email: ${fields.email}`,
      fields.orderReference ? `Order reference: ${fields.orderReference}` : "",
      "",
      fields.message,
    ]
      .filter(Boolean)
      .join("\n");

    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    setBusy(false);
    setState({
      tone: "ok",
      text: "Your email app should now be open with the message ready to send.",
    });
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      {state ? (
        <p
          className={`banner-note${state.tone === "error" ? " is-error" : " is-ok"}`}
          role={state.tone === "error" ? "alert" : "status"}
        >
          {state.text}
        </p>
      ) : null}

      <div className="field-grid">
        <div className="field">
          <label className="label" htmlFor="c-name">
            Name
          </label>
          <input
            id="c-name"
            className="input"
            value={fields.name}
            autoComplete="name"
            aria-invalid={errors.name ? "true" : undefined}
            onChange={(e) => set("name", e.target.value)}
          />
          {errors.name ? <span className="error-text">{errors.name}</span> : null}
        </div>

        <div className="field">
          <label className="label" htmlFor="c-email">
            Email
          </label>
          <input
            id="c-email"
            className="input"
            type="email"
            value={fields.email}
            autoComplete="email"
            aria-invalid={errors.email ? "true" : undefined}
            onChange={(e) => set("email", e.target.value)}
          />
          {errors.email ? <span className="error-text">{errors.email}</span> : null}
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="c-ref">
            Order reference (optional)
          </label>
          <input
            id="c-ref"
            className="input"
            value={fields.orderReference}
            placeholder="e.g. KCP-XXXXXX"
            onChange={(e) => set("orderReference", e.target.value)}
          />
        </div>

        <div className="field span-2">
          <label className="label" htmlFor="c-message">
            How can we help?
          </label>
          <textarea
            id="c-message"
            className="textarea"
            rows={6}
            value={fields.message}
            aria-invalid={errors.message ? "true" : undefined}
            placeholder="Tell us about your artwork, quantities and timeline."
            onChange={(e) => set("message", e.target.value)}
          />
          {errors.message ? <span className="error-text">{errors.message}</span> : null}
        </div>
      </div>

      <button type="submit" className="btn btn-lg" disabled={busy}>
        Send message
      </button>

      <p className="hint">
        Prefer to design first?{" "}
        <Link href="/customize" className="link-inline">
          Open the designer
        </Link>
        .
      </p>
    </form>
  );
}