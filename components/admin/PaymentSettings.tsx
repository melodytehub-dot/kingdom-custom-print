"use client";

import { useEffect, useState } from "react";

const fields = [
  ["STRIPE_SECRET_KEY", "Stripe secret key"],
  ["STRIPE_WEBHOOK_SECRET", "Stripe webhook signing secret"],
  ["PAYPAL_CLIENT_ID", "PayPal client ID"],
  ["PAYPAL_CLIENT_SECRET", "PayPal client secret"],
  ["PAYPAL_WEBHOOK_ID", "PayPal webhook ID"],
] as const;

export default function PaymentSettings() {
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/admin/payment-settings", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { setAvailable(data.available); setConfigured(data.fields); })
      .catch(() => setNotice("Payment settings could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if ((values.PAYPAL_ENVIRONMENT === "live" || /^(sk|rk)_live_/.test(values.STRIPE_SECRET_KEY ?? "")) && !window.confirm("These are live payment credentials and can be used for real customer charges once checkout is enabled. Continue?")) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/payment-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, fields: values }) });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error || "Could not save payment settings."); return; }
      setConfigured(result.fields); setValues({}); setPassword("");
      setNotice("Credentials saved securely. Webhooks and a payment test must still be verified.");
    } catch { setNotice("Connection error. Please try again."); } finally { setSaving(false); }
  }

  return <section aria-label="Payment settings" className="admin-subsection">
    <h2 className="h3">Payment credentials</h2>
    <p className="small muted">Enter credentials from the business account. Values are encrypted and cannot be viewed again. Leave a field blank to keep its current value.</p>
    <p className="small muted">Both payment methods remain disabled until their checkout and webhook tests are completed. Saving credentials alone does not enable checkout.</p>
    {loading ? <p>Loading payment settings…</p> : !available ? <p role="status">Secure credential storage needs to be configured before these fields can be used.</p> :
      <form className="settings-form" onSubmit={save} autoComplete="off">
        {(["STRIPE", "PAYPAL"] as const).map((provider) => <fieldset className="fieldset" key={provider}>
          <legend className="label">{provider === "STRIPE" ? "Stripe" : "PayPal"}</legend>
          <p className="hint">Webhook endpoint: <code>{provider === "STRIPE" ? "https://kingdomcustomprint.com/api/webhook" : "https://kingdomcustomprint.com/api/paypal/webhook"}</code></p>
          {fields.filter(([key]) => key.startsWith(provider)).map(([key, label]) => <div className="field" key={key}>
            <label className="label" htmlFor={`payment-${key}`}>{label} {configured[key] ? "(saved)" : "(not saved)"}</label>
            <input id={`payment-${key}`} className="input" type="password" autoComplete="new-password" value={values[key] ?? ""} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
          </div>)}
          {provider === "PAYPAL" ? <div className="field"><label className="label" htmlFor="paypal-environment">PayPal environment</label><select id="paypal-environment" className="select" value={values.PAYPAL_ENVIRONMENT ?? ""} onChange={(event) => setValues({ ...values, PAYPAL_ENVIRONMENT: event.target.value })}><option value="">Keep current setting</option><option value="sandbox">Sandbox (test)</option><option value="live">Live</option></select><span className="hint">Changing the environment requires the matching client ID, secret, and webhook ID.</span></div> : null}
        </fieldset>)}
        <div className="field"><label className="label" htmlFor="payment-admin-password">Confirm admin password</label><input id="payment-admin-password" className="input" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save payment credentials"}</button>
      </form>}
    {notice ? <p role="status" className="banner-note">{notice}</p> : null}
  </section>;
}
