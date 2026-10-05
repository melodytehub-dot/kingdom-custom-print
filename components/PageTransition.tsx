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

  return <div key={pathname} className="page-transition">{children}</div>;
}
