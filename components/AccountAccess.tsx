"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

export function AccountAccess({ googleEnabled = false, googleError = "" }: { googleEnabled?: boolean; googleError?: string }) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/account/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, name: data.get("name"), email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json() as { error?: string; verificationRequired?: boolean };
      if (!response.ok) {
        setError(result.error ?? "Could not access your account.");
        return;
      }
      if (result.verificationRequired) {
        setMessage("Check your inbox for a confirmation link. Once confirmed, you can sign in.");
        return;
      }
      router.refresh();
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-access">
      <div className="account-mode" role="group" aria-label="Account access">
        <button type="button" className={mode === "login" ? "active" : ""} aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
        <button type="button" className={mode === "register" ? "active" : ""} aria-pressed={mode === "register"} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
      </div>
      <form method="post" action="/api/account/auth" onSubmit={submit}>
        {mode === "register" ? <label className="account-field">Full name<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label> : null}
        <label className="account-field">Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label className="account-field">Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 10 : undefined} maxLength={200} required /></label>
        {mode === "register" ? <p className="account-hint">Use at least 10 characters.</p> : null}
        {error ? <p className="account-error" role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        <button className="account-submit" type="submit" disabled={busy || !hydrated}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
      </form>
      {googleEnabled ? <div className="account-google"><span>or</span><a href="/api/account/google">Continue with Google</a></div> : null}
      {googleError ? <p className="account-error" role="alert">{googleError}</p> : null}
    </div>
  );
}

function subscribeHydration() { return () => {}; }

export function AccountSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/account/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }
  return <button type="button" className="account-signout" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>;
}
