import type postgres from "postgres";
import type { CartItem } from "./types";

type Tx = postgres.TransactionSql;
type Variant = { productId: number; color: string; size: string; quantity: number };
type Reservation = { product_id: number; color_name: string; size_label: string; quantity: number };

export class InsufficientStockError extends Error {
  constructor() { super("Some selected sizes or colors are no longer available. Please review your cart or contact us."); }
}

async function lockProducts(tx: Tx, productIds: number[]) {
  for (const id of [...new Set(productIds)].sort((a, b) => a - b)) {
    await tx`SELECT pg_advisory_xact_lock(1296786772, ${id})`;
  }
}

/** Called inside the order transaction. Unknown counts are unavailable when enabled. */
export async function reserveInventory(tx: Tx, orderId: number, items: CartItem[]): Promise<void> {
  const [control] = await tx<{ enabled: boolean }[]>`SELECT enabled FROM inventory_control WHERE id = true FOR SHARE`;
  // Finished goods always require an explicit stock count. Existing customizable
  // blanks continue to follow the shop-wide inventory setting.
  const stockItems = control?.enabled ? items : items.filter(item => item.saleMode === "ready-made");
  if (!stockItems.length) return;
  const grouped = new Map<string, Variant>();
  for (const item of stockItems) for (const line of item.lines) {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new InsufficientStockError();
    const key = JSON.stringify([item.productId, item.colorName, line.label]);
    const row = grouped.get(key) ?? { productId: item.productId, color: item.colorName, size: line.label, quantity: 0 };
    row.quantity += line.qty; grouped.set(key, row);
  }
  const rows = [...grouped.values()].sort((a, b) => a.productId - b.productId || a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
  await lockProducts(tx, rows.map((row) => row.productId));
  for (const row of rows) {
    const [stock] = await tx<{ quantity: number }[]>`SELECT quantity FROM inventory_stock WHERE product_id = ${row.productId} AND color_name = ${row.color} AND size_label = ${row.size} FOR UPDATE`;
    if (!stock) throw new InsufficientStockError();
    const [held] = await tx<{ quantity: number }[]>`SELECT COALESCE(sum(quantity), 0)::int AS quantity FROM inventory_reservations WHERE product_id = ${row.productId} AND color_name = ${row.color} AND size_label = ${row.size}`;
    if (stock.quantity - held.quantity < row.quantity) throw new InsufficientStockError();
    await tx`INSERT INTO inventory_reservations (order_id, product_id, color_name, size_label, quantity) VALUES (${orderId}, ${row.productId}, ${row.color}, ${row.size}, ${row.quantity})`;
  }
}

/** Consume a held reservation only once, in the payment-confirmation transaction. */
export async function consumeInventory(tx: Tx, orderId: number): Promise<void> {
  const rows = await tx<Reservation[]>`SELECT product_id, color_name, size_label, quantity FROM inventory_reservations WHERE order_id = ${orderId} ORDER BY product_id, color_name, size_label`;
  await lockProducts(tx, rows.map((row) => row.product_id));
  for (const row of rows) {
    const [updated] = await tx<{ quantity: number; name: string }[]>`UPDATE inventory_stock AS s SET quantity = s.quantity - ${row.quantity}, updated_at = now() FROM products p WHERE s.product_id = ${row.product_id} AND s.color_name = ${row.color_name} AND s.size_label = ${row.size_label} AND s.quantity >= ${row.quantity} AND p.id = s.product_id RETURNING s.quantity, p.name`;
    if (!updated) throw new Error("Inventory reservation could not be consumed.");
    await tx`INSERT INTO inventory_adjustments (product_id, product_name, color_name, size_label, previous_quantity, new_quantity) VALUES (${row.product_id}, ${updated.name}, ${row.color_name}, ${row.size_label}, ${updated.quantity + row.quantity}, ${updated.quantity})`;
  }
  if (rows.length) await tx`DELETE FROM inventory_reservations WHERE order_id = ${orderId}`;
}

/** Only call after checkout setup fails or the provider confirms expiration. */
export async function releaseInventory(tx: Tx, orderId: number): Promise<void> {
  const rows = await tx<Reservation[]>`SELECT product_id, color_name, size_label, quantity FROM inventory_reservations WHERE order_id = ${orderId} ORDER BY product_id, color_name, size_label`;
  await lockProducts(tx, rows.map((row) => row.product_id));
  if (rows.length) await tx`DELETE FROM inventory_reservations WHERE order_id = ${orderId}`;
}
