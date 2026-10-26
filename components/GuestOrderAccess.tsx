"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GuestOrderAccess({ reference }: { reference: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/order/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, email }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "The order could not be verified.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="track-form order-access-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="label" htmlFor="order-access-email">
          Checkout email
        </label>
        <input
          id="order-access-email"
          className="input"
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "order-access-error" : "order-access-hint"}
          required
        />
        {error ? (
          <span id="order-access-error" className="error-text" role="alert">
            {error}
          </span>
        ) : (
          <span id="order-access-hint" className="hint">
            Enter the email used at checkout to view items, artwork, notes, and totals.
          </span>
        )}
      </div>
      <button type="submit" className="btn" disabled={busy || !email.trim()}>
        {busy ? "Verifying…" : "View full order"}
      </button>
    </form>
  );
}
