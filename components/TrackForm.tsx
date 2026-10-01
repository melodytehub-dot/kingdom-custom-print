"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ArrowRight from "@/components/icons/ArrowRight";

export default function TrackForm() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = reference.trim().toUpperCase();
    if (!value) {
      setError("Enter the order reference from your confirmation email.");
      return;
    }
    setError(null);
    setBusy(true);
    router.push(`/order/${encodeURIComponent(value)}`);
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
            You will find it at the top of your confirmation email, in the form KCP-XXXXXX.
          </span>
        )}
      </div>

      <button type="submit" className="btn btn-lg" disabled={busy}>
        {busy ? "Looking up…" : "Track order"}
        <ArrowRight />
      </button>
    </form>
  );
}
