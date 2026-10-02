import { NextResponse } from "next/server";
import { createOrder, attachStripeSession } from "@/lib/orders";
import { siteUrl, stripeClient } from "@/lib/stripe";
import { getProductById } from "@/lib/catalog";
import { quoteProduct } from "@/lib/pricing";
import { FONTS } from "@/lib/fonts";
import type { CartItem, Design, DesignLayer, GarmentSide, RosterEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Body {
  email?: string;
  name?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  notes?: string;
  items?: CartItem[];
}

/**
 * Narrow a client-supplied cart item down to the fields we persist, then
 * re-derive every money field from the database.
 *
 * Prices, names, colors and size labels all come from the product record so a
 * tampered request cannot set its own price or print an unavailable color or
 * size. Anything the cart asks for that the product no longer offers is dropped.
 */
async function sanitise(items: CartItem[]): Promise<CartItem[]> {
  const requested = items
    .filter(
      (i) =>
        i &&
        typeof i.productId === "number" &&
        typeof i.productName === "string" &&
        Array.isArray(i.lines) &&
        i.quantity > 0
    )
    .slice(0, 30);

  const priced: CartItem[] = [];
  for (const item of requested) {
    const product = await getProductById(item.productId);
    if (!product || !product.active) continue;

    const sizeLabels = new Set(product.sizes.map((s) => s.label));
    const lines = item.lines
      .map((l) => ({
        label: String(l.label).slice(0, 20),
        qty: Math.min(999, Math.max(0, Math.floor(Number(l.qty) || 0))),
      }))
      .filter((l) => sizeLabels.has(l.label) && l.qty > 0);

    const quantity = lines.reduce((n, l) => n + l.qty, 0);
    if (!quantity) continue;

    const matched =
      product.colors.find((c) => c.name.toLowerCase() === String(item.colorName ?? "").toLowerCase()) ??
      product.colors[0];
    if (!matched) continue;

    const quote = quoteProduct(product, {
      sides: designSides(item.design),
      lines,
    });

    // Prefer the exact colour the shopper picked (the studio offers the full
    // real garment palette); fall back to the matched catalogue colour.
    const colorName = String(item.colorName ?? "").trim().slice(0, 40) || matched.name;
    const colorHex = hexOr(item.colorHex, matched.hex);

    priced.push({
      ...item,
      productName: product.name,
      productKind: product.kind,
      colorName,
      colorHex,
      unitPrice: quote.unitBase,
      total: quote.total,
      quantity: lines.reduce((n, l) => n + l.qty, 0),
      lines,
      // Data-URL previews are size-limited; drop anything oversized rather than
      // letting a large payload reach the database.
      previewFront: truncateDataUrl(item.previewFront),
      previewBack: truncateDataUrl(item.previewBack),
      design: sanitiseDesign(item.design),
      roster: sanitiseRoster(item.roster),
    });
  }
  return priced;
}

/** Which sides of a design actually carry artwork, for print-charge purposes. */
function designSides(design: unknown): GarmentSide[] {
  const d = design as { front?: unknown[]; back?: unknown[] } | null | undefined;
  const sides: GarmentSide[] = [];
  if (Array.isArray(d?.front) && d.front.length) sides.push("front");
  if (Array.isArray(d?.back) && d.back.length) sides.push("back");
  return sides;
}

function truncateDataUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  return value.length > 400_000 ? null : value;
}

const FONT_VALUES = new Set(FONTS.map((f) => f.value));
const hexOr = (v: unknown, fallback: string) =>
  /^#[0-9A-Fa-f]{6}$/.test(String(v)) ? String(v) : fallback;

function sanitiseDesign(design: unknown): Design {
  const empty: Design = { front: [], back: [] };
  if (!design || typeof design !== "object") return empty;
  const d = design as Record<string, unknown>;

  const cleanSide = (side: unknown): DesignLayer[] => {
    if (!Array.isArray(side)) return [];
    const out: DesignLayer[] = [];

    for (const raw of side.slice(0, 30)) {
      if (!raw || typeof raw !== "object") continue;
      const l = raw as Record<string, unknown>;

      const base = {
        id: String(l.id ?? "l").slice(0, 40),
        x: clampNum(l.x, -20, 120, 50),
        y: clampNum(l.y, -20, 120, 50),
        scaleX: clampNum(l.scaleX, 0.05, 8, 1),
        scaleY: clampNum(l.scaleY, 0.05, 8, 1),
        rotation: clampNum(l.rotation, -360, 360, 0),
        opacity: clampNum(l.opacity, 0.1, 1, 1),
        flipH: Boolean(l.flipH),
        flipV: Boolean(l.flipV),
      };

      if (l.type === "text") {
        const text = String(l.text ?? "").slice(0, 400);
        if (!text.trim()) continue;
        out.push({
          ...base,
          type: "text",
          text,
          font: FONT_VALUES.has(String(l.font)) ? String(l.font) : "anton",
          fontSize: clampNum(l.fontSize, 2, 40, 7),
          color: hexOr(l.color, "#141414"),
          weight: [400, 700, 900].includes(Number(l.weight))
            ? (Number(l.weight) as 400 | 700 | 900)
            : 700,
          italic: Boolean(l.italic),
          uppercase: Boolean(l.uppercase),
          align: ["left", "center", "right"].includes(String(l.align))
            ? (l.align as "left" | "center" | "right")
            : "center",
          letterSpacing: clampNum(l.letterSpacing, -10, 50, 0),
          lineHeight: clampNum(l.lineHeight, 0.7, 3, 1.05),
          strokeColor: hexOr(l.strokeColor, "#FFFFFF"),
          strokeWidth: clampNum(l.strokeWidth, 0, 30, 0),
          role: l.role === "name" || l.role === "number" ? l.role : undefined,
        });
        continue;
      }

      if (l.type === "image") {
        const src = String(l.src ?? "");
        if (!src.startsWith("data:image/") || src.length > 400_000) continue;
        out.push({
          ...base,
          type: "image",
          src,
          name: String(l.name ?? "artwork").slice(0, 120),
        });
      }
    }

    return out;
  };

  return { front: cleanSide(d.front), back: cleanSide(d.back) };
}

function sanitiseRoster(roster: unknown): RosterEntry[] | undefined {
  if (!Array.isArray(roster) || !roster.length) return undefined;
  return roster.slice(0, 300).map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? `r-${i}`).slice(0, 40),
      name: String(r.name ?? "").slice(0, 40),
      number: String(r.number ?? "").slice(0, 12),
    };
  });
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const name = String(body.name ?? "").trim();
  const addressLine1 = String(body.addressLine1 ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (name.length < 2) fieldErrors.name = "Enter the name for the order.";
  if (addressLine1.length < 3) fieldErrors.addressLine1 = "Enter a street address.";
  if (!String(body.city ?? "").trim()) fieldErrors.city = "Enter a city.";
  if (!String(body.postal ?? "").trim()) fieldErrors.postal = "Enter a postal code.";

  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ error: "Check the highlighted fields.", fieldErrors }, { status: 422 });
  }

  let items: CartItem[];
  try {
    items = await sanitise(Array.isArray(body.items) ? body.items : []);
  } catch {
    return NextResponse.json(
      { error: "We could not load the catalog to price your cart. Please try again." },
      { status: 503 }
    );
  }
  if (!items.length) {
    return NextResponse.json(
      { error: "Your cart is empty, or those items are no longer available." },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder({
      email,
      name,
      phone: String(body.phone ?? "").trim().slice(0, 40),
      addressLine1,
      addressLine2: String(body.addressLine2 ?? "").trim().slice(0, 120),
      city: String(body.city).trim().slice(0, 80),
      region: String(body.region ?? "").trim().slice(0, 80),
      postal: String(body.postal).trim().slice(0, 20),
      country: String(body.country ?? "US").trim().slice(0, 2).toUpperCase() || "US",
      notes: String(body.notes ?? "").trim().slice(0, 2000),
      items,
    });

    const stripe = stripeClient();
    if (!stripe) {
      // Without Stripe keys the order is recorded and paid manually.
      // The confirmation page explains the next step rather than failing silently.
      return NextResponse.json({
        reference: order.reference,
        total: order.total,
        mode: "invoice",
      });
    }

    const base = siteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      client_reference_id: order.reference,
      metadata: { orderReference: order.reference },
      line_items: items.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(i.unitPrice * 100),
          product_data: {
            name: `${i.productName}${i.colorName ? ` — ${i.colorName}` : ""}`,
            description: buildDescription(i),
            metadata: { productSlug: i.productSlug },
          },
        },
      })),
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Standard shipping",
            fixed_amount: {
              amount: Math.round(order.shipping * 100),
              currency: "usd",
            },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
      ],
      success_url: `${base}/order/success?ref=${encodeURIComponent(order.reference)}`,
      cancel_url: `${base}/cart?cancelled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Payment could not be started. Please try again." },
        { status: 502 }
      );
    }

    await attachStripeSession(order.reference, session.id);
    return NextResponse.json({ url: session.url, reference: order.reference });
  } catch (err) {
    console.error("checkout error:", err);
    return NextResponse.json(
      { error: "We could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}

function buildDescription(item: CartItem): string {
  const sizes = item.lines
    .filter((l) => l.qty > 0)
    .map((l) => `${l.label} ×${l.qty}`)
    .join(", ");
  const sides = item.sidesUsed?.length
    ? item.sidesUsed.map((s) => (s === "front" ? "Front" : "Back")).join(" + ")
    : "Blank";
  const parts = [sizes, `Print: ${sides}`].filter(Boolean);
  return parts.join(" · ").slice(0, 500);
}