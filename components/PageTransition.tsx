"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Keeps route changes positioned at the beginning and gives them a quiet entrance. */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const html = document.documentElement;
    const previousBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    const reset = () => window.scrollTo(0, 0);
    reset();
    const frame = window.requestAnimationFrame(reset);
    const settle = window.setTimeout(() => {
      reset();
      html.style.scrollBehavior = previousBehavior;
    }, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      html.style.scrollBehavior = previousBehavior;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/customize/")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const root = document.querySelector<HTMLElement>(".page-transition");
    if (!root) return;
    const selector = "[data-reveal], .kcp-heading, .kcp-project-intro, .kcp-project-card, .kcp-process-inner > *, .kcp-contact, .kcp-questions-inner > *, .page-head";
    const registered = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("kcp-revealed");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    const register = () => root.querySelectorAll<HTMLElement>(selector).forEach(target => {
      if (!registered.has(target)) {
        registered.add(target);
        observer.observe(target);
      }
    });
    register();
    // Route content can stream in after this layout's effect has mounted.
    const changes = new MutationObserver(register);
    changes.observe(root, { childList: true, subtree: true });
    return () => { changes.disconnect(); observer.disconnect(); };
  }, [pathname]);

  const isStudio = pathname.startsWith("/customize/") || pathname.startsWith("/admin");
  return <div key={pathname} className={`page-transition${isStudio ? "" : " kcp-storefront-page"}`}>{children}</div>;
}
