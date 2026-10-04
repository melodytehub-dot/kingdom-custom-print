"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";

const KEY = "kcp-wishlist-v1";
const EVENT = "kcp-wishlist-change";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}
function snapshot() {
  try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; }
}
function parse(value: string): string[] {
  try {
    const items: unknown = JSON.parse(value);
    return Array.isArray(items) ? [...new Set(items.filter((item): item is string => typeof item === "string" && /^[a-z0-9-]+$/.test(item)))].slice(0, 200) : [];
  } catch { return []; }
}
const WishlistContext = createContext<{ slugs: string[]; has: (slug: string) => boolean; toggle: (slug: string) => void }>({ slugs: [], has: () => false, toggle: () => {} });
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const slugs = useMemo(() => parse(raw), [raw]);
  const [error, setError] = useState("");
  function toggle(slug: string) {
    const current = parse(snapshot());
    const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug].slice(-200);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
      setError("");
    } catch { setError("Your browser could not save this item. Please allow local storage and try again."); }
  }
  return <WishlistContext.Provider value={{ slugs, has: (slug) => slugs.includes(slug), toggle }}>
    {children}
    {error ? <div className="wishlist-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss message">×</button></div> : null}
  </WishlistContext.Provider>;
}
export function useWishlist() { return useContext(WishlistContext); }
