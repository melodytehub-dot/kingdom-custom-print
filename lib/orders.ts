import { sql, num } from "./db";
import { getSettings } from "./catalog";
import { round2 } from "./pricing";
import type {
  AdminOrder,
  AdminOrderDetail,
  CustomerRow,
  DashboardStats,
} from "./catalog-types";
import type {
  CartItem,
  Design,
  GarmentSide,
  OrderStatus,
  ProductKind,
  SizeLine,
} from "./types";

export interface CheckoutInput {
  email: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  notes: string;
  items: CartItem[];
}

export interface OrderSummary {
  reference: string;
  email: string;
  name: string;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
  stripeSessionId: string | null;
  items: {
    productName: string;
    productKind: ProductKind;
    colorName: string;
    colorHex: string;
    quantity: number;
    unitPrice: number;
    sizeBreakdown: SizeLine[];
    design: Design;
    previewFront: string | null;
    previewBack: string | null;
  }[];
}

function reference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `KCP-${code}`;
}

export function shippingFor(subtotal: number, settings: { shippingFlat: number; freeShippingThreshold: number }): number {
  if (subtotal <= 0) return 0;
  if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) return 0;
  return round2(settings.shippingFlat);
}

/**
 * Creates the order and its line items. Totals are recomputed from the
 * authoritative settings rather than trusting the client payload.
 */
export async function createOrder(input: CheckoutInput): Promise<{
  reference: string;
  subtotal: number;
  shipping: number;
  total: number;
}> {
  if (!input.items.length) throw new Error("Cart is empty.");

  const settings = await getSettings();
  const subtotal = round2(input.items.reduce((n, i) => n + i.total, 0));
  const shipping = shippingFor(subtotal, settings);
  const total = round2(subtotal + shipping);

  const ref = reference();

  await sql.begin(async (tx) => {
    const [customer] = await tx<{ id: number }[]>`
      INSERT INTO customers (email, name, phone)
      VALUES (${input.email}, ${input.name}, ${input.phone})
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE customers.phone END
      RETURNING id`;

    const [order] = await tx<{ id: number }[]>`
      INSERT INTO orders (reference, customer_id, email, name, phone,
        address_line1, address_line2, city, region, postal, country, notes,
        status, subtotal, shipping, total)
      VALUES (${ref}, ${customer.id}, ${input.email}, ${input.name}, ${input.phone},
        ${input.addressLine1}, ${input.addressLine2}, ${input.city}, ${input.region},
        ${input.postal}, ${input.country}, ${input.notes},
        'pending', ${subtotal}, ${shipping}, ${total})
      RETURNING id`;

    for (const item of input.items) {
      await tx`
        INSERT INTO order_items (order_id, product_id, product_name, product_kind,
          color_name, color_hex, unit_price, quantity, size_breakdown, design,
          preview_front, preview_back, notes)
        VALUES (${order.id}, ${item.productId}, ${item.productName}, ${item.productKind},
          ${item.colorName}, ${item.colorHex}, ${item.unitPrice}, ${item.quantity},
          ${tx.json(item.lines as never)},
          ${tx.json(item.design as never)},
          ${item.previewFront}, ${item.previewBack}, '')`;
    }
  });

  return { reference: ref, subtotal, shipping, total };
}

export async function attachStripeSession(
  orderReference: string,
  sessionId: string
): Promise<void> {
  await sql`
    UPDATE orders SET stripe_session_id = ${sessionId}
    WHERE reference = ${orderReference}`;
}

/**
 * Called from the Stripe webhook. Idempotent: replayed events return the same
 * result rather than double-marking the order.
 */
export async function markOrderPaid(
  sessionId: string,
  paymentIntentId: string | null
): Promise<{ reference: string } | null> {
  const rows = await sql<{ reference: string; status: OrderStatus }[]>`
    UPDATE orders
    SET status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END,
        paid_at = now(),
        stripe_payment_intent = ${paymentIntentId},
        updated_at = now()
    WHERE stripe_session_id = ${sessionId}
      AND paid_at IS NULL
    RETURNING reference, status`;

  if (rows.length) return { reference: rows[0].reference };

  const existing = await sql<{ reference: string }[]>`
    SELECT reference FROM orders WHERE stripe_session_id = ${sessionId} LIMIT 1`;
  return existing[0] ?? null;
}

export async function cancelOrder(reference: string): Promise<boolean> {
  const result = await sql`
    UPDATE orders SET status = 'cancelled', updated_at = now()
    WHERE reference = ${reference} AND status = 'pending'`;
  return result.count > 0;
}

export async function getOrderByReference(reference: string): Promise<OrderSummary | null> {
  const rows = await sql<
    {
      reference: string;
      email: string;
      name: string;
      status: OrderStatus;
      subtotal: unknown;
      shipping: unknown;
      total: unknown;
      created_at: Date;
      stripe_session_id: string | null;
    }[]
  >`
    SELECT reference, email, name, status, subtotal, shipping, total, created_at, stripe_session_id
    FROM orders WHERE reference = ${reference} LIMIT 1`;

  if (!rows.length) return null;
  const row = rows[0];

  const items = await sql<
    {
      product_name: string;
      product_kind: ProductKind;
      color_name: string;
      color_hex: string;
      quantity: number;
      unit_price: unknown;
      size_breakdown: SizeLine[];
      design: Design;
      preview_front: string | null;
      preview_back: string | null;
    }[]
  >`
    SELECT product_name, product_kind, color_name, color_hex, quantity, unit_price,
      size_breakdown, design, preview_front, preview_back
    FROM order_items WHERE order_id = (SELECT id FROM orders WHERE reference = ${reference})
    ORDER BY id`;

  return {
    reference: row.reference,
    email: row.email,
    name: row.name,
    status: row.status,
    subtotal: num(row.subtotal),
    shipping: num(row.shipping),
    total: num(row.total),
    createdAt: row.created_at.toISOString(),
    stripeSessionId: row.stripe_session_id,
    items: items.map((i) => ({
      productName: i.product_name,
      productKind: i.product_kind,
      colorName: i.color_name,
      colorHex: i.color_hex,
      quantity: i.quantity,
      unitPrice: num(i.unit_price),
      sizeBreakdown: Array.isArray(i.size_breakdown) ? i.size_breakdown : [],
      design: i.design ?? { front: [], back: [] },
      previewFront: i.preview_front,
      previewBack: i.preview_back,
    })),
  };
}

export async function listOrders(options?: {
  status?: OrderStatus;
  limit?: number;
}): Promise<AdminOrder[]> {
  const rows = await sql<
    {
      reference: string;
      email: string;
      name: string;
      city: string;
      region: string;
      status: OrderStatus;
      total: unknown;
      item_count: number;
      garment_count: number;
      created_at: Date;
    }[]
  >`
    SELECT o.reference, o.email, o.name, o.city, o.region, o.status, o.total,
      (SELECT count(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
      (SELECT COALESCE(sum(oi.quantity), 0)::int FROM order_items oi WHERE oi.order_id = o.id) AS garment_count,
      o.created_at
    FROM orders o
    WHERE (${options?.status ?? null}::text IS NULL OR o.status = ${options?.status ?? null})
    ORDER BY o.created_at DESC
    LIMIT ${options?.limit ?? 200}`;

  return rows.map((r) => ({
    reference: r.reference,
    email: r.email,
    name: r.name,
    city: r.city,
    region: r.region,
    status: r.status,
    total: num(r.total),
    itemCount: r.item_count,
    garmentCount: r.garment_count,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getAdminOrder(reference: string): Promise<AdminOrderDetail | null> {
  const base = await getOrderByReference(reference);
  if (!base) return null;

  const rows = await sql<
    {
      phone: string;
      address_line1: string;
      address_line2: string;
      city: string;
      region: string;
      postal: string;
      country: string;
      notes: string;
      paid_at: Date | null;
    }[]
  >`
    SELECT phone, address_line1, address_line2, city, region, postal, country, notes, paid_at
    FROM orders WHERE reference = ${reference} LIMIT 1`;

  const r = rows[0];
  return {
    ...base,
    phone: r.phone,
    addressLine1: r.address_line1,
    addressLine2: r.address_line2,
    city: r.city,
    region: r.region,
    postal: r.postal,
    country: r.country,
    notes: r.notes,
    paidAt: r.paid_at ? r.paid_at.toISOString() : null,
  };
}

export async function updateOrderStatus(
  reference: string,
  status: OrderStatus
): Promise<boolean> {
  const result = await sql`
    UPDATE orders SET status = ${status}, updated_at = now() WHERE reference = ${reference}`;
  return result.count > 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const rows = await sql<
    {
      orders: number;
      paid_orders: number;
      revenue: unknown;
      garments: number;
    }[]
  >`
    SELECT
      count(*)::int AS orders,
      count(*) FILTER (WHERE status <> 'cancelled')::int AS paid_orders,
      COALESCE(sum(total) FILTER (WHERE status = 'paid' OR status = 'in_proof'
        OR status = 'in_production' OR status = 'shipped'), 0) AS revenue,
      COALESCE((SELECT sum(quantity) FROM order_items), 0)::int AS garments
    FROM orders`;

  const r = rows[0];
  return {
    orders: r.orders,
    paidOrders: r.paid_orders,
    revenue: num(r.revenue),
    garments: r.garments,
    lowActivity: r.orders < 5,
  };
}

export async function listCustomers(): Promise<CustomerRow[]> {
  const rows = await sql<
    {
      email: string;
      name: string;
      phone: string;
      orders: number;
      spent: unknown;
      last_order_at: Date;
    }[]
  >`
    SELECT c.email, c.name, c.phone,
      count(o.id)::int AS orders,
      COALESCE(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS spent,
      max(o.created_at) AS last_order_at
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id, c.email, c.name, c.phone
    ORDER BY max(o.created_at) DESC NULLS LAST
    LIMIT 200`;

  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    phone: r.phone,
    orders: r.orders,
    spent: num(r.spent),
    lastOrderAt: r.last_order_at ? r.last_order_at.toISOString() : "",
  }));
}

export function sidesLabel(sides: GarmentSide[]): string {
  if (!sides.length) return "Blank";
  return sides.map((s) => (s === "front" ? "Front" : "Back")).join(" + ");
}

export type { AdminOrder, AdminOrderDetail, CustomerRow, DashboardStats };
