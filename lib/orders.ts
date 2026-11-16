import { sql, num } from "./db";
import type { SqlFragment } from "./sqlite";
import {
  consumeInventoryStatements,
  inventoryEnabled,
  isGuardFailure,
  InsufficientStockError,
  releaseInventoryStatements,
  reserveInventoryStatements,
} from "./inventory-reservations";
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

export class CheckoutAttemptConflictError extends Error {}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).filter((key) => obj[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function orderItemSnapshot(item: CartItem) {
  return { productId: item.productId, productName: item.productName, productKind: item.productKind,
    saleMode: item.saleMode ?? "customizable",
    colorName: item.colorName, colorHex: item.colorHex, unitPrice: item.unitPrice,
    quantity: item.quantity, lines: item.lines, design: item.design,
    previewFront: item.previewFront ?? null, previewBack: item.previewBack ?? null,
    roster: item.roster ?? [], designNotes: item.designNotes ?? "" };
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
    saleMode: "customizable" | "ready-made";
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

/** Timestamps are stored as ISO-8601 text, so normalise anything read back. */
function iso(value: unknown): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

/** JSON columns are text in SQLite and parsed on the way out. */
function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function shippingFor(subtotal: number, settings: { shippingFlat: number; freeShippingThreshold: number }): number {
  if (subtotal <= 0) return 0;
  if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) return 0;
  return round2(settings.shippingFlat);
}

interface ExistingAttempt {
  id: number;
  reference: string;
  email: string;
  account_id: number | null;
  status: OrderStatus;
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  notes: string;
  subtotal: number;
  shipping: number;
  total: number;
}

/**
 * Accepts a retried checkout only when the stored order is the same request:
 * same buyer, same totals, same lines. Anything else is a conflicting reuse of
 * the attempt id.
 */
async function assertAttemptMatches(
  existing: ExistingAttempt,
  input: CheckoutInput,
  totals: { subtotal: number; shipping: number; total: number }
): Promise<void> {
  if (
    existing.email !== input.email ||
    existing.account_id !== (input.accountId ?? null) ||
    existing.status !== "pending"
  ) {
    throw new CheckoutAttemptConflictError();
  }
  const previousItems = await sql<{
    product_id: number | null;
    product_name: string;
    product_kind: ProductKind;
    sale_mode: "customizable" | "ready-made";
    color_name: string;
    color_hex: string;
    unit_price: number;
    quantity: number;
    size_breakdown: string;
    design: string;
    preview_front: string | null;
    preview_back: string | null;
    roster: string;
    notes: string;
  }[]>`
    SELECT product_id, product_name, product_kind, sale_mode, color_name, color_hex, unit_price, quantity,
      size_breakdown, design, preview_front, preview_back, roster, notes
    FROM order_items WHERE order_id = ${existing.id} ORDER BY id`;
  const previous = previousItems.map((item) => ({
    productId: item.product_id,
    productName: item.product_name,
    productKind: item.product_kind,
    saleMode: item.sale_mode,
    colorName: item.color_name,
    colorHex: item.color_hex,
    unitPrice: num(item.unit_price),
    quantity: item.quantity,
    lines: parseJson<SizeLine[]>(item.size_breakdown, []),
    design: parseJson<Design>(item.design, { front: [], back: [] }),
    previewFront: item.preview_front,
    previewBack: item.preview_back,
    roster: parseJson<RosterEntry[]>(item.roster, []),
    designNotes: item.notes ?? "",
  }));
  if (
    existing.name !== input.name ||
    existing.phone !== input.phone ||
    existing.address_line1 !== input.addressLine1 ||
    existing.address_line2 !== input.addressLine2 ||
    existing.city !== input.city ||
    existing.region !== input.region ||
    existing.postal !== input.postal ||
    existing.country !== input.country ||
    existing.notes !== input.notes ||
    num(existing.subtotal) !== totals.subtotal ||
    num(existing.shipping) !== totals.shipping ||
    num(existing.total) !== totals.total ||
    canonical(previous) !== canonical(input.items.map(orderItemSnapshot))
  ) {
    throw new CheckoutAttemptConflictError();
  }
}

/**
 * Creates the order and its line items. Totals are recomputed from the
 * authoritative settings rather than trusting the client payload.
 *
 * Everything that must land together runs as one `sql.batch`: the customer
 * upsert, the order row, the stock holds and the line items. Dependent
 * statements key off the freshly generated reference, so a replay that loses
 * the race inserts nothing.
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
  const totals = { subtotal, shipping, total };

  const [existing] = await sql<ExistingAttempt[]>`
    SELECT id, reference, email, account_id, status, name, phone, address_line1, address_line2,
      city, region, postal, country, notes, subtotal, shipping, total
    FROM orders WHERE checkout_attempt_id = ${input.checkoutAttemptId} LIMIT 1`;
  if (existing) {
    await assertAttemptMatches(existing, input, totals);
    return { reference: existing.reference, ...totals, reused: true };
  }

  const ref = reference();
  const orderId = sql`(SELECT id FROM orders WHERE reference = ${ref})`;
  const enabled = await inventoryEnabled();

  const statements: SqlFragment[] = [
    sql`
      INSERT INTO customers (email, name, phone)
      VALUES (${input.email}, ${input.name}, ${input.phone})
      ON CONFLICT (email) DO UPDATE
        SET name = excluded.name,
            phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE customers.phone END`,
    sql`
      INSERT INTO orders (reference, customer_id, account_id, email, name, phone,
        address_line1, address_line2, city, region, postal, country, notes,
        status, subtotal, shipping, total, checkout_attempt_id)
      VALUES (${ref}, (SELECT id FROM customers WHERE email = ${input.email}), ${input.accountId ?? null},
        ${input.email}, ${input.name}, ${input.phone},
        ${input.addressLine1}, ${input.addressLine2}, ${input.city}, ${input.region},
        ${input.postal}, ${input.country}, ${input.notes},
        'pending', ${subtotal}, ${shipping}, ${total}, ${input.checkoutAttemptId})
      ON CONFLICT (checkout_attempt_id) WHERE checkout_attempt_id IS NOT NULL DO NOTHING`,
    ...reserveInventoryStatements(orderId, input.items, enabled),
  ];

  for (const item of input.items) {
    statements.push(sql`
      INSERT INTO order_items (order_id, product_id, product_name, product_kind, sale_mode,
        color_name, color_hex, unit_price, quantity, size_breakdown, design,
        preview_front, preview_back, roster, notes)
      SELECT ${orderId}, ${item.productId}, ${item.productName}, ${item.productKind}, ${item.saleMode ?? "customizable"},
        ${item.colorName}, ${item.colorHex}, ${item.unitPrice}, ${item.quantity},
        ${sql.json(item.lines)},
        ${sql.json(item.design)},
        ${item.previewFront}, ${item.previewBack}, ${sql.json(item.roster ?? [])},
        ${item.designNotes ?? ""}
      WHERE EXISTS (SELECT 1 FROM orders WHERE reference = ${ref})`);
  }

  try {
    await sql.batch(statements);
  } catch (error) {
    if (isGuardFailure(error)) throw new InsufficientStockError();
    throw error;
  }

  const [inserted] = await sql<{ reference: string }[]>`
    SELECT reference FROM orders WHERE reference = ${ref} LIMIT 1`;
  if (inserted) return { reference: inserted.reference, ...totals, reused: false };

  // A concurrent request created the order for this attempt first.
  const [winner] = await sql<ExistingAttempt[]>`
    SELECT id, reference, email, account_id, status, name, phone, address_line1, address_line2,
      city, region, postal, country, notes, subtotal, shipping, total
    FROM orders WHERE checkout_attempt_id = ${input.checkoutAttemptId} LIMIT 1`;
  if (!winner) throw new CheckoutAttemptConflictError();
  await assertAttemptMatches(winner, input, totals);
  return { reference: winner.reference, ...totals, reused: true };
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
  const [row] = await sql<{ id: number; reference: string; total: number; status: OrderStatus; paid_at: string | null; paypal_capture_id: string | null }[]>`
    SELECT id, reference, total, status, paid_at, paypal_capture_id FROM orders
    WHERE paypal_order_id = ${paypalOrderId} LIMIT 1`;
  if (!row || Math.round(num(row.total) * 100) !== Math.round(Number(amount) * 100)) return null;
  if (row.paid_at) return row.paypal_capture_id === captureId ? { reference: row.reference } : null;
  if (row.status !== "pending") return null;

  const updated = await sql<{ id: number }[]>`
    UPDATE orders
    SET status = 'paid',
        paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        paypal_capture_id = ${captureId},
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ${row.id} AND paid_at IS NULL AND status = 'pending'
    RETURNING id`;
  // A concurrent delivery already confirmed this payment.
  if (!updated.length) return { reference: row.reference };

  await sql.batch([
    ...(await consumeInventoryStatements(row.id)),
    sql`
      INSERT INTO order_status_events (order_id, from_status, to_status, actor, note, external_event_id)
      VALUES (${row.id}, 'pending', 'paid', 'system', 'Payment confirmed by PayPal.', ${eventId ?? null})
      ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`,
  ]);
  return { reference: row.reference };
}

export async function markPayPalRefunded(captureId: string, eventId?: string): Promise<void> {
  const [row] = await sql<{ id: number; status: OrderStatus }[]>`
    SELECT id, status FROM orders WHERE paypal_capture_id = ${captureId} AND paid_at IS NOT NULL LIMIT 1`;
  if (!row || row.status === "refunded") return;

  const updated = await sql<{ id: number }[]>`
    UPDATE orders
    SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ${row.id} AND status <> 'refunded'
    RETURNING id`;
  if (!updated.length) return;

  await sql`
    INSERT INTO order_status_events (order_id, from_status, to_status, actor, note, external_event_id)
    VALUES (${row.id}, ${row.status}, 'refunded', 'system', 'Full refund confirmed by PayPal.', ${eventId ?? null})
    ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`;
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
  const updated = await sql<{ id: number; reference: string; status: OrderStatus }[]>`
    UPDATE orders
    SET status = 'paid',
        paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        stripe_payment_intent = ${paymentIntentId},
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE stripe_session_id = ${sessionId}
      AND paid_at IS NULL
      AND status = 'pending'
    RETURNING id, reference, status`;

  if (updated.length) {
    await sql.batch([
      ...(await consumeInventoryStatements(updated[0].id)),
      sql`
        INSERT INTO order_status_events
          (order_id, from_status, to_status, actor, note, external_event_id)
        VALUES (${updated[0].id}, 'pending', ${updated[0].status}, 'stripe',
          'Payment confirmed by signed Stripe webhook.', ${eventId ?? null})
        ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`,
    ]);
    return { reference: updated[0].reference };
  }

  const existing = await sql<{ reference: string }[]>`
    SELECT reference FROM orders WHERE stripe_session_id = ${sessionId} LIMIT 1`;
  return existing[0] ?? null;
}

export async function markOrderRefunded(
  paymentIntentId: string,
  eventId?: string
): Promise<{ reference: string } | null> {
  const [current] = await sql<{ id: number; reference: string; status: OrderStatus }[]>`
    SELECT id, reference, status FROM orders
    WHERE stripe_payment_intent = ${paymentIntentId} AND paid_at IS NOT NULL
    LIMIT 1`;
  if (!current) return null;
  if (current.status === "refunded") return { reference: current.reference };

  const updated = await sql<{ id: number }[]>`
    UPDATE orders
    SET status = 'refunded', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ${current.id} AND status <> 'refunded'
    RETURNING id`;
  if (!updated.length) return { reference: current.reference };

  await sql`
    INSERT INTO order_status_events
      (order_id, from_status, to_status, actor, note, external_event_id)
    VALUES (${current.id}, ${current.status}, 'refunded', 'stripe',
      'Full refund confirmed by signed Stripe webhook.', ${eventId ?? null})
    ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`;
  return { reference: current.reference };
}

export async function cancelOrder(
  reference: string,
  options: {
    actor?: "stripe" | "system";
    eventId?: string;
    note?: string;
    providerClosed?: boolean;
    stripeSessionId?: string;
    paypalOrderId?: string;
  } = {}
): Promise<boolean> {
  const actor = options.actor ?? "stripe";
  const note = options.note ?? (actor === "stripe"
    ? "Stripe Checkout session expired before payment."
    : "Checkout could not be started; the unpaid order was closed automatically.");

  const [current] = await sql<{ id: number; status: OrderStatus; stripe_session_id: string | null; paypal_order_id: string | null }[]>`
    SELECT id, status, stripe_session_id, paypal_order_id FROM orders WHERE reference = ${reference} LIMIT 1`;
  if (!current) return false;
  if (options.stripeSessionId && current.stripe_session_id && current.stripe_session_id !== options.stripeSessionId) return false;
  if (options.paypalOrderId && current.paypal_order_id !== options.paypalOrderId) return false;
  if ((current.stripe_session_id || current.paypal_order_id) && !options.providerClosed) return false;

  if (current.status === "cancelled" && options.providerClosed) {
    await sql.batch([
      sql`UPDATE orders SET inventory_provider_closed = 1 WHERE id = ${current.id}`,
      ...(await releaseInventoryStatements(current.id)),
    ]);
    return true;
  }
  if (current.status !== "pending") return false;

  // Compare-and-set so two expirations cannot cancel twice or race a payment.
  const rows = await sql<{ id: number }[]>`
    UPDATE orders
    SET status = 'cancelled', inventory_provider_closed = 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE reference = ${reference} AND status = 'pending'
    RETURNING id`;
  if (!rows.length) return false;

  await sql.batch([
    ...(await releaseInventoryStatements(rows[0].id)),
    sql`
      INSERT INTO order_status_events
        (order_id, from_status, to_status, actor, note, external_event_id)
      VALUES (${rows[0].id}, 'pending', 'cancelled', ${actor},
        ${note}, ${options.eventId ?? null})
      ON CONFLICT (external_event_id) WHERE external_event_id IS NOT NULL DO NOTHING`,
  ]);
  return true;
}

export async function getPublicOrderStatus(reference: string): Promise<PublicOrderStatus | null> {
  const rows = await sql<{ reference: string; status: OrderStatus; created_at: string }[]>`
    SELECT reference, status, created_at FROM orders WHERE reference = ${reference} LIMIT 1`;
  return rows[0] ? {
    reference: rows[0].reference,
    status: rows[0].status,
    createdAt: iso(rows[0].created_at),
  } : null;
}

export async function orderBelongsToAccount(reference: string, accountId: number | null): Promise<boolean> {
  if (!accountId) return false;
  const rows = await sql<{ owned: number }[]>`
    SELECT 1 AS owned FROM orders
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
      created_at: string;
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
      sale_mode: "customizable" | "ready-made";
      color_name: string;
      color_hex: string;
      quantity: number;
      unit_price: unknown;
      size_breakdown: string;
      design: string;
      preview_front: string | null;
      preview_back: string | null;
      roster: string;
      notes: string;
    }[]
  >`
    SELECT product_name, product_kind, sale_mode, color_name, color_hex, quantity, unit_price,
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
    createdAt: iso(row.created_at),
    stripeSessionId: row.stripe_session_id,
    items: items.map((i) => ({
      productName: i.product_name,
      productKind: i.product_kind,
      saleMode: i.sale_mode,
      colorName: i.color_name,
      colorHex: i.color_hex,
      quantity: i.quantity,
      unitPrice: num(i.unit_price),
      sizeBreakdown: parseJson<SizeLine[]>(i.size_breakdown, []),
      design: parseJson<Design>(i.design, { front: [], back: [] }),
      previewFront: i.preview_front,
      previewBack: i.preview_back,
      designNotes: i.notes,
      roster: parseJson<RosterEntry[]>(i.roster, []),
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
      created_at: string;
    }[]
  >`
    SELECT o.reference, o.email, o.name, o.city, o.region, o.status, o.total,
      (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
      (SELECT COALESCE(sum(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS garment_count,
      o.created_at
    FROM orders o
    WHERE (${options?.status ?? null} IS NULL OR o.status = ${options?.status ?? null})
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
    itemCount: num(r.item_count),
    garmentCount: num(r.garment_count),
    createdAt: iso(r.created_at),
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
      paid_at: string | null;
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
    created_at: string;
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
    paidAt: r.paid_at ? iso(r.paid_at) : null,
    refundProvider: r.paid_at && base.status !== "refunded" ? (r.stripe_payment_intent ? "stripe" : r.paypal_capture_id ? "paypal" : null) : null,
    statusHistory: history.map((event) => ({
      fromStatus: event.from_status,
      toStatus: event.to_status,
      actor: event.actor,
      note: event.note,
      createdAt: iso(event.created_at),
    })),
  };
}

export async function updateOrderStatus(
  reference: string,
  status: OrderStatus
): Promise<{ ok: boolean; reason?: "not-found" | "invalid-transition" }> {
  const [current] = await sql<{ id: number; status: OrderStatus; paid_at: string | null; stripe_session_id: string | null; paypal_order_id: string | null }[]>`
    SELECT id, status, paid_at, stripe_session_id, paypal_order_id FROM orders WHERE reference = ${reference} LIMIT 1`;
  if (!current) return { ok: false, reason: "not-found" };
  if (!(ADMIN_ORDER_TRANSITIONS[current.status] ?? []).includes(status)) {
    return { ok: false, reason: "invalid-transition" };
  }
  if (status === "cancelled") {
    if (current.stripe_session_id || current.paypal_order_id) return { ok: false, reason: "invalid-transition" };
    const held = await sql`SELECT 1 FROM inventory_reservations WHERE order_id = ${current.id} LIMIT 1`;
    if (held.length) return { ok: false, reason: "invalid-transition" };
  }
  if (status !== "cancelled" && !current.paid_at) {
    return { ok: false, reason: "invalid-transition" };
  }

  // Compare-and-set on the status that was checked above.
  const updated = await sql<{ id: number }[]>`
    UPDATE orders
    SET status = ${status}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ${current.id} AND status = ${current.status}
    RETURNING id`;
  if (!updated.length) return { ok: false, reason: "invalid-transition" };

  await sql`
    INSERT INTO order_status_events
      (order_id, from_status, to_status, actor, note)
    VALUES (${current.id}, ${current.status}, ${status}, 'admin', 'Status changed in admin workspace.')`;
  return { ok: true };
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
      count(*) AS orders,
      count(*) FILTER (WHERE paid_at IS NOT NULL AND status <> 'refunded') AS paid_orders,
      COALESCE(sum(total) FILTER (WHERE status = 'paid' OR status = 'in_proof'
        OR status = 'in_production' OR status = 'shipped'), 0) AS revenue,
      COALESCE((SELECT sum(quantity) FROM order_items), 0) AS garments
    FROM orders`;

  const r = rows[0];
  return {
    orders: num(r.orders),
    paidOrders: num(r.paid_orders),
    revenue: num(r.revenue),
    garments: num(r.garments),
    lowActivity: num(r.orders) < 5,
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
      last_order_at: string | null;
    }[]
  >`
    SELECT c.email, c.name, c.phone,
      count(o.id) AS orders,
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
    orders: num(r.orders),
    spent: num(r.spent),
    lastOrderAt: r.last_order_at ? iso(r.last_order_at) : "",
  }));
}

export function sidesLabel(sides: GarmentSide[]): string {
  if (!sides.length) return "Blank";
  return sides.map((s) => (s === "front" ? "Front" : "Back")).join(" + ");
}

export type { AdminOrder, AdminOrderDetail, CustomerRow, DashboardStats };
