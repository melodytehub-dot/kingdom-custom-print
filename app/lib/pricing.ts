import type { Product, SizeKey } from "./products";

export interface QtyLine { size: SizeKey; qty: number; }

export function priceFor(product: Product, sidesUsed: number, lines: QtyLine[]): { unit: number; total: number; count: number } {
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const sizeUp = lines.reduce((n, l) => n + (l.size === "2XL" ? 2 * l.qty : 0), 0);
  let unit = product.basePrice + sidesUsed * product.printFeePerSide;
  if (count >= 24) unit -= 3;
  else if (count >= 12) unit -= 2;
  else if (count >= 6) unit -= 1;
  const total = Math.max(0, unit * count + sizeUp);
  return { unit: Math.max(0, unit), total, count };
}

export function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
