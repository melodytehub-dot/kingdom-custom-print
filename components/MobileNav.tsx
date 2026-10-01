"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Category } from "@/lib/types";
import ArrowRight from "./icons/ArrowRight";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/customize", label: "Design" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function MobileNav({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [shownFor, setShownFor] = useState(pathname);

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

      {open
        ? createPortal(
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
                src="/brand/kingdom-logo.png"
                alt=""
                width={1400}
                height={843}
                className="mobile-logo"
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
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
                    <Link href={l.href}>
                      {l.label}
                      <ArrowRight size={20} />
                    </Link>
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

            <div className="mobile-panel-foot">
              <Link href="/customize" className="btn btn-red btn-block">
                Start designing
              </Link>
            </div>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
