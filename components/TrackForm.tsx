"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ArrowRight from "@/components/icons/ArrowRight";

export default function TrackForm() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = reference.trim().toUpperCase();
    if (!value) {
      setError("Enter the order reference shown after checkout.");
      return;
    }
    if (!/^KCP-[A-Z2-9]{6}$/.test(value)) {
      setError("Enter a reference in the form KCP-XXXXXX.");
      return;
    }
    setError(null);
    setBusy(true);
    if (!email.trim()) {
      router.push(`/order/${encodeURIComponent(value)}`);
      return;
    }
    try {
      const response = await fetch("/api/order/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: value, email }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "The order could not be verified.");
        return;
      }
      router.push(`/order/${encodeURIComponent(value)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="track-form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="label" htmlFor="track-ref">
          Order reference
        </label>
        <input
          id="track-ref"
          className="input"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="KCP-XXXXXX"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "track-error" : "track-hint"}
        />
        {error ? (
          <span className="error-text" id="track-error" role="alert">
            {error}
          </span>
        ) : (
          <span className="hint" id="track-hint">
            This was shown after checkout and uses the form KCP-XXXXXX.
          </span>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="track-email">
          Checkout email <span className="muted">(optional)</span>
        </label>
        <input
          id="track-email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          maxLength={254}
        />
        <span className="hint">Add it to unlock private order details. Leave blank to see status only.</span>
      </div>

      <button type="submit" className="btn btn-lg" disabled={busy}>
        {busy ? "Looking up…" : "Track order"}
        <ArrowRight />
      </button>
    </form>
  );
}
