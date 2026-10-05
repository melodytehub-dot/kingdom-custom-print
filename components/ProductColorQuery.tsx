"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Apply a card's selected color without making the whole product page dynamic. */
export default function ProductColorQuery({ allowed, onColor }: { allowed: string[]; onColor: (slug: string) => void }) {
  const color = useSearchParams().get("color");
  useEffect(() => {
    if (color && allowed.includes(color)) onColor(color);
  }, [color, allowed, onColor]);
  return null;
}
