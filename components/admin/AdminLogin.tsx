"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

function subscribeHydration() { return () => {}; }

export default function AdminLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "Could not sign in. Please try again.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError(controller.signal.aborted ? "Sign-in took too long. Please try again." : "Could not connect. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="panel panel-pad">
        <p className="eyebrow">Admin</p>
        <h1 className="h2">Sign in</h1>

        {!configured ? (
          <p className="banner-note" role="status">
            Admin access is not set up on this deployment. Add an{" "}
            <code>ADMIN_PASSWORD</code> environment variable to enable it.
          </p>
        ) : (
          <p className="small muted">
            Enter the admin password to manage products, orders and site settings.
          </p>
        )}

        <form method="post" action="/api/admin/login" onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={!configured || busy}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? "admin-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? (
              <span className="error-text" id="admin-error">
                {error}
              </span>
            ) : null}
          </div>

          <button type="submit" className="btn btn-block" disabled={!configured || busy || !hydrated}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
