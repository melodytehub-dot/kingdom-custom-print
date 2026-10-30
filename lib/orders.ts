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
  RosterEntry,
  SizeLine,
} from "./types";
import { ADMIN_ORDER_TRANSITIONS } from "./types";

export interface CheckoutInput {
  checkoutAttemptId: string;
  accountId?: number | null;
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
    designNotes: string;
    roster: RosterEntry[];
  }[];
}

export interface PublicOrderStatus {
  reference: string;
  status: OrderStatus;
  createdAt: string;
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
  reused: boolean;
}> {
  if (!input.items.length) throw new Error("Cart is empty.");

  const settings = await getSettings();
  const subtotal = round2(input.items.reduce((n, i) => n + i.total, 0));
  const shipping = shippingFor(subtotal, settings);
  const total = round2(subtotal + shipping);

  const ref = reference();

  const result = await sql.begin(async (tx) => {
    const [customer] = await tx<{ id: number }[]>`
      INSERT INTO customers (email, name, phone)
      VALUES (${input.email}, ${input.name}, ${input.phone})
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE customers.phone END
      RETURNING id`;

    const [order] = await tx<{ id: number; reference: string }[]>`
      INSERT INTO orders (reference, customer_id, account_id, email, name, phone,
        address_line1, address_line2, city, region, postal, country, notes,
        status, subtotal, shipping, total, checkout_attempt_id)
      VALUES (${ref}, ${customer.id}, ${input.accountId ?? null}, ${input.email}, ${input.name}, ${input.phone},
        ${input.addressLine1}, ${input.addressLine2}, ${input.city}, ${input.region},
        ${input.postal}, ${input.country}, ${input.notes},
        'pending', ${subtotal}, ${shipping}, ${total}, ${input.checkoutAttemptId})
      ON CONFLICT (checkout_attempt_id) WHERE checkout_attempt_id IS NOT NULL DO NOTHING
      RETURNING id, reference`;

    if (!order) {
      const [existing] = await tx<{
        reference: string;
        email: string;
        account_id: number | null;
        status: OrderStatus;
      }[]>`
        SELECT reference, email, account_id, status FROM orders
        WHERE checkout_attempt_id = ${input.checkoutAttemptId}
        LIMIT 1`;
      if (!existing
        || existing.email !== input.email
        || existing.account_id !== (input.accountId ?? null)
        || existing.status !== "pending") {
        throw new Error("Checkout attempt cannot be reused.");
      }
      return { reference: existing.reference, reused: true };
    }

    for (const item of input.items) {
      await tx`
        INSERT INTO order_items (order_id, product_id, product_name, product_kind,
          color_name, color_hex, unit_price, quantity, size_breakdown, design,
          preview_front, preview_back, roster, notes)
        VALUES (${order.id}, ${item.productId}, ${item.productName}, ${item.productKind},
          ${item.colorName}, ${item.colorHex}, ${item.unitPrice}, ${item.quantity},
          ${tx.json(item.lines as never)},
          ${tx.json(item.design as never)},
          ${item.previewFront}, ${item.previewBack}, ${tx.json((item.roster ?? []) as never)},
          ${item.designNotes ?? ""})`;
    }
    return { reference: order.reference, reused: false };
  });

  return { reference: result.reference, subtotal, shipping, total, reused: result.reused };
}

export async function attachStripeSession(
  orderReference: string,
  sessionId: string
): Promise<void> {
  const result = await sql`
    UPDATE orders SET stripe_session_id = ${sessionId}
    WHERE reference = ${orderReference} AND status = 'pending' AND paypal_order_id IS NULL AND (stripe_session_id IS NULL OR stripe_session_id = ${sessionId})`;
  if (!result.count) throw new Error("Stripe session could not be linked.");
}

export async function attachPayPalOrder(reference: string, paypalOrderId: string): Promise<void> {
  const rows = await sql`UPDATE orders SET paypal_order_id = ${paypalOrderId} WHERE reference = ${reference} AND status = 'pending' AND stripe_session_id IS NULL AND (paypal_order_id IS NULL OR paypal_order_id = ${paypalOrderId})`;
  if (!rows.count) throw new Error("PayPal order could not be linked.");
}

export async function paypalOrderForCapture(paypalOrderId: string): Promise<{ reference: string; total: number; status: OrderStatus } | null> {
  const [row] = await sql<{ reference: string; total: number; status: OrderStatus }[]>`SELECT reference, total, status FROM orders WHERE paypal_order_id = ${paypalOrderId} LIMIT 1`;
  return row ? { ...row, total: num(row.total) } : null;
}

export async function recordPayPalCapture(paypalOrderId: string, captureId: string, amount: string, currency: string, eventId?: string): Promise<{ reference: string } | null> {
  if (currency !== "USD" || !/^\d+\.\d{2}$/.test(amount)) return null;
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: number; reference: string; total: number; status: OrderStatus; paid_at: Date | null; paypal_capture_id: string | null }[]>`SELECT id, reference, total, status, paid_at, paypal_capture_id FROM orders WHERE paypal_order_id = ${paypalOrderId} LIMIT 1 FOR UPDATE`;
    if (!row || Math.round(num(row.total) * 100) !== Math.round(Number(amount) * 100)) return null;
    if (row.paid_at) return row.paypal_capture_id === captureId ? { reference: row.reference } : null;
    if (row.status !== "pending") return null;
    await tx`UPDATE orders SET status = 'paid', paid_at = now(), paypal_capture_id = ${captureId}, updated_at = now() WHERE id = ${row.id}`;
    await tx`INSERT INTO order_status_events (order_id, from_status, to_status, actor, note, external_event_id) VALUES (${row.id}, 'pending', 'paid', 'system', 'Payment confirmed by PayPal.', ${eventId ?? null}) ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`;
    return { reference: row.reference };
  });
}

export async function markPayPalRefunded(captureId: string, eventId?: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [row] = await tx<{ id: number; status: OrderStatus }[]>`SELECT id, status FROM orders WHERE paypal_capture_id = ${captureId} AND paid_at IS NOT NULL LIMIT 1 FOR UPDATE`;
    if (!row || row.status === "refunded") return;
    await tx`UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = ${row.id}`;
    await tx`INSERT INTO order_status_events (order_id, from_status, to_status, actor, note, external_event_id) VALUES (${row.id}, ${row.status}, 'refunded', 'system', 'Full refund confirmed by PayPal.', ${eventId ?? null}) ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`;
  });
}

/**
 * Called from the Stripe webhook. Idempotent: replayed events return the same
 * result rather than double-marking the order.
 */
export async function markOrderPaid(
  sessionId: string,
  paymentIntentId: string | null,
  eventId?: string
): Promise<{ reference: string } | null> {
  const rows = await sql.begin(async (tx) => {
    const updated = await tx<{ id: number; reference: string; status: OrderStatus }[]>`
      UPDATE orders
      SET status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END,
          paid_at = now(),
          stripe_payment_intent = ${paymentIntentId},
          updated_at = now()
      WHERE stripe_session_id = ${sessionId}
        AND paid_at IS NULL
        AND status = 'pending'
      RETURNING id, reference, status`;
    if (updated.length) {
      await tx`INSERT INTO order_status_events
        (order_id, from_status, to_status, actor, note, external_event_id)
        VALUES (${updated[0].id}, 'pending', ${updated[0].status}, 'stripe',
          'Payment confirmed by signed Stripe webhook.', ${eventId ?? null})
        ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`;
    }
    return updated;
  });

  if (rows.length) return { reference: rows[0].reference };

  const existing = await sql<{ reference: string }[]>`
    SELECT reference FROM orders WHERE stripe_session_id = ${sessionId} LIMIT 1`;
  return existing[0] ?? null;
}

export async function markOrderRefunded(
  paymentIntentId: string,
  eventId?: string
): Promise<{ reference: string } | null> {
  return sql.begin(async (tx) => {
    const [current] = await tx<{
      id: number;
      reference: string;
      status: OrderStatus;
    }[]>`
      SELECT id, reference, status FROM orders
      WHERE stripe_payment_intent = ${paymentIntentId} AND paid_at IS NOT NULL
      LIMIT 1 FOR UPDATE`;
    if (!current) return null;
    if (current.status !== "refunded") {
      await tx`UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = ${current.id}`;
      await tx`INSERT INTO order_status_events
        (order_id, from_status, to_status, actor, note, external_event_id)
        VALUES (${current.id}, ${current.status}, 'refunded', 'stripe',
          'Full refund confirmed by signed Stripe webhook.', ${eventId ?? null})
        ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`;
    }
    return { reference: current.reference };
  });
}

export async function cancelOrder(
  reference: string,
  options: {
    actor?: "stripe" | "system";
    eventId?: string;
    note?: string;
  } = {}
): Promise<boolean> {
  const actor = options.actor ?? "stripe";
  const note = options.note ?? (actor === "stripe"
    ? "Stripe Checkout session expired before payment."
    : "Checkout could not be started; the unpaid order was closed automatically.");
  return sql.begin(async (tx) => {
    const rows = await tx<{ id: number }[]>`
      UPDATE orders SET status = 'cancelled', updated_at = now()
      WHERE reference = ${reference} AND status = 'pending'
      RETURNING id`;
    if (!rows.length) return false;
    await tx`INSERT INTO order_status_events
      (order_id, from_status, to_status, actor, note, external_event_id)
      VALUES (${rows[0].id}, 'pending', 'cancelled', ${actor},
        ${note}, ${options.eventId ?? null})
      ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`;
    return true;
  });
}

export async function getPublicOrderStatus(reference: string): Promise<PublicOrderStatus | null> {
  const rows = await sql<{ reference: string; status: OrderStatus; created_at: Date }[]>`
    SELECT reference, status, created_at FROM orders WHERE reference = ${reference} LIMIT 1`;
  return rows[0] ? {
    reference: rows[0].reference,
    status: rows[0].status,
    createdAt: rows[0].created_at.toISOString(),
  } : null;
}

export async function orderBelongsToAccount(reference: string, accountId: number | null): Promise<boolean> {
  if (!accountId) return false;
  const rows = await sql<{ owned: boolean }[]>`
    SELECT true AS owned FROM orders
    WHERE reference = ${reference} AND account_id = ${accountId}
    LIMIT 1`;
  return Boolean(rows[0]?.owned);
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
      roster: RosterEntry[];
      notes: string;
    }[]
  >`
    SELECT product_name, product_kind, color_name, color_hex, quantity, unit_price,
      size_breakdown, design, preview_front, preview_back, roster, notes
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
      designNotes: i.notes,
      roster: Array.isArray(i.roster) ? i.roster : [],
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
      stripe_payment_intent: string | null;
      paypal_capture_id: string | null;
    }[]
  >`
    SELECT phone, address_line1, address_line2, city, region, postal, country, notes, paid_at, stripe_payment_intent, paypal_capture_id
    FROM orders WHERE reference = ${reference} LIMIT 1`;

  const r = rows[0];
  const history = await sql<{
    from_status: OrderStatus | null;
    to_status: OrderStatus;
    actor: "stripe" | "admin" | "system";
    note: string;
    created_at: Date;
  }[]>`
    SELECT from_status, to_status, actor, note, created_at
    FROM order_status_events
    WHERE order_id = (SELECT id FROM orders WHERE reference = ${reference})
    ORDER BY created_at DESC, id DESC`;
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
    refundProvider: r.paid_at && base.status !== "refunded" ? (r.stripe_payment_intent ? "stripe" : r.paypal_capture_id ? "paypal" : null) : null,
    statusHistory: history.map((event) => ({
      fromStatus: event.from_status,
      toStatus: event.to_status,
      actor: event.actor,
      note: event.note,
      createdAt: event.created_at.toISOString(),
    })),
  };
}

export async function updateOrderStatus(
  reference: string,
  status: OrderStatus
): Promise<{ ok: boolean; reason?: "not-found" | "invalid-transition" }> {
  return sql.begin(async (tx) => {
    const [current] = await tx<{ id: number; status: OrderStatus; paid_at: Date | null }[]>`
      SELECT id, status, paid_at FROM orders WHERE reference = ${reference} LIMIT 1 FOR UPDATE`;
    if (!current) return { ok: false, reason: "not-found" };
    if (!(ADMIN_ORDER_TRANSITIONS[current.status] ?? []).includes(status)) {
      return { ok: false, reason: "invalid-transition" };
    }
    if (status !== "cancelled" && !current.paid_at) {
      return { ok: false, reason: "invalid-transition" };
    }
    await tx`UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${current.id}`;
    await tx`INSERT INTO order_status_events
      (order_id, from_status, to_status, actor, note)
      VALUES (${current.id}, ${current.status}, ${status}, 'admin', 'Status changed in admin workspace.')`;
    return { ok: true };
  });
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
      count(*) FILTER (WHERE paid_at IS NOT NULL AND status <> 'refunded')::int AS paid_orders,
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
      COALESCE(sum(o.total) FILTER (WHERE o.paid_at IS NOT NULL AND o.status <> 'refunded'), 0) AS spent,
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
