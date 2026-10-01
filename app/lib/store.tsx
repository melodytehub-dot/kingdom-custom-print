"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface DesignLayer {
  id: string; type: "text" | "image";
  x: number; y: number; scale: number; rotation: number;
  text?: string; font?: string; size?: number; color?: string; outline?: string;
  src?: string; name?: string;
}
export interface CartItem {
  key: string; productSlug: string; productName: string; kind: string;
  colorId: string; colorName: string; colorHex: string;
  sides: Record<"front" | "back", DesignLayer[]>;
  previewFront: string | null; previewBack: string | null;
  lines: { size: string; qty: number }[];
  unit: number; total: number; count: number;
  createdAt: number;
}

interface Store {
  cart: CartItem[]; wishlist: string[];
  addToCart: (i: CartItem) => void;
  updateQty: (key: string, size: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  toggleWish: (slug: string) => void;
  cartCount: number; cartTotal: number;
}

const Ctx = createContext<Store | null>(null);
function load<T>(k: string, fb: T): T {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : fb; } catch { return fb; }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setCart(load("kcp-cart", [])); setWishlist(load("kcp-wish", [])); setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("kcp-cart", JSON.stringify(cart)); }, [cart, ready]);
  useEffect(() => { if (ready) localStorage.setItem("kcp-wish", JSON.stringify(wishlist)); }, [wishlist, ready]);

  const value = useMemo<Store>(() => ({
    cart, wishlist,
    addToCart: (i) => setCart((c) => [...c, i]),
    updateQty: (key, size, qty) => setCart((c) => c.map((it) => {
      if (it.key !== key) return it;
      const lines = it.lines.map((l) => (l.size === size ? { ...l, qty: Math.max(0, qty) } : l)).filter((l) => l.qty > 0);
      if (!lines.length) return it;
      const count = lines.reduce((n, l) => n + l.qty, 0);
      return { ...it, lines, count, total: it.unit * count };
    }).filter((it) => it.lines.length > 0)),
    removeFromCart: (key) => setCart((c) => c.filter((i) => i.key !== key)),
    clearCart: () => setCart([]),
    toggleWish: (slug) => setWishlist((w) => (w.includes(slug) ? w.filter((x) => x !== slug) : [...w, slug])),
    cartCount: cart.reduce((n, i) => n + i.count, 0),
    cartTotal: cart.reduce((n, i) => n + i.total, 0)
  }), [cart, wishlist]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("Store not ready");
  return s;
}
