import type {
  GarmentSide,
  PersonalizationKind,
  PriceBreak,
  Product,
  SizeLine,
} from "./types";

/** Per-garment charge for printing individual names and/or numbers. */
export const PERSONALIZATION_FEE: Record<PersonalizationKind, number> = {
  none: 0,
  names: 4,
  numbers: 3,
  both: 6,
};

export interface PriceQuote {
  /** Price for a single garment including print charges and size surcharges. */
  unitPrice: number;
  /** Total for the configured quantity. */
  total: number;
  quantity: number;
  /** Per-garment price before size surcharges — what the unit column shows. */
  unitBase: number;
  /** Sum of size surcharges across the breakdown, for display. */
  surchargeTotal: number;
  printCharge: number;
  /** Cheapest tier that applied, if the quantity crossed one. */
  appliedBreak: number | null;
}

/** The highest tier whose minimum quantity is met, or zero. */
export function resolveBreak(
  breaks: PriceBreak[],
  quantity: number
): PriceBreak | null {
  let best: PriceBreak | null = null;
  for (const b of breaks) {
    if (quantity >= b.minQty && (!best || b.minQty > best.minQty)) best = b;
  }
  return best;
}

export function totalQuantity(lines: SizeLine[]): number {
  return lines.reduce((sum, l) => sum + Math.max(0, l.qty), 0);
}

export function sidesUsedCount(sides: GarmentSide[]): number {
  return sides.filter((s) => s === "front" || s === "back").length;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Blank price + per-side print charge, adjusted by the quantity tier,
 * plus size surcharges which are charged per unit rather than per order.
 */
export function quoteProduct(
  product: Pick<
    Product,
    "basePrice" | "printFeePerSide" | "priceBreaks" | "sizes"
  >,
  options: {
    sides: GarmentSide[];
    lines: SizeLine[];
    personalization?: PersonalizationKind;
  }
): PriceQuote {
  const quantity = totalQuantity(options.lines);
  const tier = resolveBreak(product.priceBreaks, quantity);
  const printCharge = round2(sidesUsedCount(options.sides) * product.printFeePerSide);
  const personalCharge = PERSONALIZATION_FEE[options.personalization ?? "none"];
  const unitBase = Math.max(
    0,
    product.basePrice + printCharge + personalCharge + (tier?.amountOff ?? 0)
  );

  const surchargeMap = new Map(product.sizes.map((s) => [s.label, s.surcharge]));
  const surchargeTotal = round2(
    options.lines.reduce(
      (sum, l) => sum + (surchargeMap.get(l.label) ?? 0) * Math.max(0, l.qty),
      0
    )
  );

  const unitPrice = round2(unitBase);
  return {
    unitPrice,
    unitBase: unitPrice,
    total: round2(unitPrice * quantity + surchargeTotal),
    quantity,
    surchargeTotal,
    printCharge,
    appliedBreak: tier ? tier.minQty : null,
  };
}

/** Lowest achievable unit price at the largest published tier. */
export function lowestUnitPrice(product: Product): number | null {
  if (!product.priceBreaks.length) return null;
  const best = product.priceBreaks.reduce((a, b) => (b.amountOff < a.amountOff ? b : a));
  return round2(Math.max(0, product.basePrice + best.amountOff));
}

/** The largest published quantity tier, or null when none are set. */
export function largestBreakQty(product: Pick<Product, "priceBreaks">): number | null {
  if (!product.priceBreaks.length) return null;
  return product.priceBreaks.reduce((max, b) => (b.minQty > max ? b.minQty : max), 0);
}

/**
 * Lowest all-in price for one garment with a single printed side, at the
 * best published tier — the "from $X each" figure shown on product cards.
 */
export function lowestPrintedUnit(product: Product): number | null {
  if (!product.priceBreaks.length) return null;
  const best = product.priceBreaks.reduce((a, b) => (b.amountOff < a.amountOff ? b : a));
  return round2(
    Math.max(0, product.basePrice + product.printFeePerSide + best.amountOff)
  );
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(round2(n));
}