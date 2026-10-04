import type { ProductSize } from "./types";

export type SizeGroup = "adult" | "youth";

/** Youth labels are prefixed in stored/cart data so each size remains unique. */
export function sizeGroup(label: string): SizeGroup {
  return label.toUpperCase().startsWith("Y") ? "youth" : "adult";
}

export function sizeDisplayLabel(label: string): string {
  return sizeGroup(label) === "youth" ? label.slice(1) : label;
}

export function splitSizeGroups(sizes: ProductSize[]) {
  return {
    adult: sizes.filter((size) => sizeGroup(size.label) === "adult"),
    youth: sizes.filter((size) => sizeGroup(size.label) === "youth"),
  };
}

export function sizeSummary(sizes: ProductSize[]): string {
  const groups = splitSizeGroups(sizes);
  return ([
    ["Adult", groups.adult],
    ["Youth", groups.youth],
  ] as const)
    .filter(([, values]) => values.length > 0)
    .map(([title, values]) => {
      const first = sizeDisplayLabel(values[0].label);
      const last = sizeDisplayLabel(values[values.length - 1].label);
      return `${title} ${first}${first === last ? "" : `–${last}`}`;
    })
    .join(" · ");
}
