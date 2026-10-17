import type { Metadata } from "next";
import CutoutCompare from "@/components/cutout-compare/CutoutCompare";

export const metadata: Metadata = {
  title: "Background cut-out comparison",
  robots: { index: false, follow: false },
};

/** Evaluation tool for the hosted cut-out service; not linked from the store. */
export default function CutoutComparePage() {
  return <CutoutCompare />;
}
