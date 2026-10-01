"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CartItem, SizeLine } from "./types";
import { round2 } from "./pricing";

const CART_KEY = "kcp.cart.v1";

interface CartContextValue {
  items: CartItem[];
  /** False until localStorage has been read, so SSR markup can match. */
  hydrated: boolean;
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "id" | "createdAt">) => CartItem;
  removeItem: (id: string) => void;
  updateLine: (itemId: string, label: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        typeof i === "object" &&
        i !== null &&
        typeof (i as CartItem).id === "string" &&
        Array.isArray((i as CartItem).lines)
    );
  } catch {
    return [];
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------------------------------------------------------------------------
 * Module-level store.
 *
 * localStorage is an external system, so the cart is modelled as one and read
 * through useSyncExternalStore. That keeps the server HTML and the first client
 * render identical (both empty) and drops the stored cart in without an extra
 * setState pass inside an effect.
 * ------------------------------------------------------------------------- */

const EMPTY: CartItem[] = [];

let snapshot: CartItem[] | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Drop the memo so the next read re-parses storage (used after writes). */
function invalidate() {
  snapshot = null;
}

function getSnapshot(): CartItem[] {
  if (!hydrated) return EMPTY;
  return (snapshot ??= readStoredCart());
}

/** Server render and the first client render both see an empty cart. */
function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  if (!hydrated) {
    hydrated = true;
    // Re-render subscribers now that the stored cart is readable.
    queueMicrotask(emit);
  }
  listeners.add(listener);

  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key !== CART_KEY) return;
    invalidate();
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function persist(items: CartItem[]) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: the in-memory cart still works for this session.
  }
}

function commit(next: CartItem[]) {
  snapshot = next;
  persist(next);
  emit();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Debounced mirror to storage so rapid quantity edits do not thrash
  // synchronous writes on slower devices. The store itself is already current;
  // this only paces the on-disk copy.
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => persist(items), 220);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "id" | "createdAt">) => {
    const entry: CartItem = { ...item, id: makeId(), createdAt: Date.now() };
    commit([...getSnapshot(), entry]);
    return entry;
  }, []);

  const removeItem = useCallback((id: string) => {
    commit(getSnapshot().filter((i) => i.id !== id));
  }, []);

  const updateLine = useCallback((itemId: string, label: string, qty: number) => {
    commit(
      getSnapshot()
        .map((item) => {
          if (item.id !== itemId) return item;
          const clamped = Math.max(0, Math.min(999, Math.floor(qty)));
          const lines: SizeLine[] = item.lines
            .map((l) => (l.label === label ? { ...l, qty: clamped } : l))
            .filter((l) => l.qty > 0);
          const quantity = lines.reduce((n, l) => n + l.qty, 0);
          // Size surcharges are per unit and change with the size run, so the
          // total has to be rebuilt from the lines rather than rescaled.
          const surchargeTotal = round2(
            lines.reduce((n, l) => n + (item.surcharges?.[l.label] ?? 0) * l.qty, 0)
          );
          return {
            ...item,
            lines,
            quantity,
            total: round2(item.unitPrice * quantity + surchargeTotal),
          };
        })
        .filter((item) => item.lines.length > 0)
    );
  }, []);

  const clear = useCallback(() => commit([]), []);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = round2(items.reduce((n, i) => n + i.total, 0));

  const value = useMemo<CartContextValue>(() => {
    return { items, hydrated, count, subtotal, addItem, removeItem, updateLine, clear };
  }, [items, count, subtotal, addItem, removeItem, updateLine, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}