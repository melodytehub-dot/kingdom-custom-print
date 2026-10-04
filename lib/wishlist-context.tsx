"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Product } from "./types";

interface WishlistContextType {
  wishlistIds: number[];
  count: number;
  isWishlisted: (id: number) => boolean;
  toggleWishlist: (product: Product) => boolean;
  toastMessage: string | null;
  clearToast: () => void;
}

const WishlistContext = createContext<WishlistContextType>({
  wishlistIds: [],
  count: 0,
  isWishlisted: () => false,
  toggleWishlist: () => false,
  toastMessage: null,
  clearToast: () => {},
});

const STORAGE_KEY = "kcp_wishlist_ids";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setWishlistIds(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const isWishlisted = useCallback((id: number) => wishlistIds.includes(id), [wishlistIds]);

  const toggleWishlist = useCallback((product: Product) => {
    let next: number[];
    let added = false;
    if (wishlistIds.includes(product.id)) {
      next = wishlistIds.filter((id) => id !== product.id);
      added = false;
    } else {
      next = [...wishlistIds, product.id];
      added = true;
    }
    setWishlistIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }

    setToastMessage(added ? `Added "${product.name}" to wishlist` : `Removed "${product.name}" from wishlist`);
    return added;
  }, [wishlistIds]);

  const clearToast = useCallback(() => setToastMessage(null), []);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        count: wishlistIds.length,
        isWishlisted,
        toggleWishlist,
        toastMessage,
        clearToast,
      }}
    >
      {children}
      {toastMessage ? (
        <div className="mm-toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
          <button type="button" onClick={clearToast} aria-label="Dismiss">✕</button>
        </div>
      ) : null}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
