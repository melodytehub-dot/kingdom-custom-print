"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ResumeDesignPrompt() {
  const [recent, setRecent] = useState<{ slug: string; name: string } | null>(null);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("kcp.resume-prompt-shown")) return;
      const item = JSON.parse(localStorage.getItem("kcp.recent-design.v1") ?? "null") as { slug?: unknown; name?: unknown } | null;
      if (!item || typeof item.slug !== "string" || !/^[a-z0-9-]+$/.test(item.slug) || typeof item.name !== "string") return;
      const draft = JSON.parse(localStorage.getItem(`kcp.draft.v3.${item.slug}`) ?? "null");
      if (!draft?.design?.front?.length && !draft?.design?.back?.length) return;
      sessionStorage.setItem("kcp.resume-prompt-shown", "1");
      // The saved design is only available after browser storage is available.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent({ slug: item.slug, name: item.name });
    } catch { /* Storage is optional. */ }
  }, []);
  if (!recent) return null;
  return <div className="rot-resume-backdrop"><section className="rot-resume-dialog" role="dialog" aria-modal="true" aria-labelledby="home-resume-title">
    <h2 id="home-resume-title">Continue your design?</h2>
    <p>Your previous design for {recent.name} is saved on this device.</p>
    <div className="rot-resume-actions"><Link className="rot-resume-link" href={`/customize/${recent.slug}?resume=1`}>Continue designing</Link><button type="button" autoFocus onClick={() => setRecent(null)}>Not now</button></div>
  </section></div>;
}
