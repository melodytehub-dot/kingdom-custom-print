"use client";

import { useState } from "react";
import Garment from "./Garment";
import type { ProductKind } from "@/lib/types";

/** Keep a garment visible when an older or damaged saved preview cannot load. */
export default function DesignPreviewImage({ src, alt, kind, color, back = false }: {
  src?: string | null; alt: string; kind: ProductKind; color: string; back?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) {
    return <Garment kind={kind} color={color} back={back} title={src ? "Design preview unavailable" : undefined} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailedSource(src)} />;
}
