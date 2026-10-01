"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Category } from "@/lib/types";

const LINKS = [
  { href: "/shop", label: "Shop all" },
  { href: "/customize", label: "Design your own" },
  { href: "/cart", label: "Cart" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function MobileNav({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [shownFor, setShownFor] = useState(pathname);

  // A route change closes the panel. Adjusting state while rendering is the
  // documented way to react to a changed input without a second render pass;
  // link clicks also close it directly.
  if (shownFor !== pathname) {
    setShownFor(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    document.body.dataset.lock = "1";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // Move focus into the panel so keyboard and screen-reader users land inside it.
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();

    return () => {
      delete document.body.dataset.lock;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="burger"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <span className={`burger-lines${open ? " is-open" : ""}`} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open ? (
        <>
          <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="mobile-menu"
            ref={panelRef}
            className="mobile-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="mobile-panel-head">
              <Image
                src="/brand/kingdom-logo.svg"
                alt=""
                width={150}
                height={40}
                className="mobile-logo"
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    d="M3 3l12 12M15 3L3 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav aria-label="Mobile">
              <ul className="mobile-links">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>

            {categories.length ? (
              <div className="mobile-cats">
                <p className="eyebrow">Shop by product</p>
                <ul>
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/shop?category=${c.slug}`}>{c.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}