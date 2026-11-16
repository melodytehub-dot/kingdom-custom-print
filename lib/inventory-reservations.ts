import { sql } from "./db";
import type { SqlFragment } from "./sqlite";
import type { CartItem } from "./types";

type Variant = { productId: number; color: string; size: string; quantity: number };
type Reservation = { product_id: number; color_name: string; size_label: string; quantity: number };

export class InsufficientStockError extends Error {
  constructor() { super("Some selected sizes or colors are no longer available. Please review your cart or contact us."); }
}

/**
 * Inventory statements are built as fragments and run with `sql.batch`, which
 * is the atomic unit SQLite and D1 offer. Each reservation insert is condition-
 * ally applied, and a guard row (see `transaction_guards` in the schema) aborts
 * the whole batch when the requested quantity is not available.
 */

/** Whether the shop-wide stock setting is on. Finished goods always check stock. */
export async function inventoryEnabled(): Promise<boolean> {
  const [row] = await sql<{ enabled: number }[]>`SELECT enabled FROM inventory_control WHERE id = 1`;
  return row ? Boolean(row.enabled) : true;
}

/** Statements that hold stock for a pending order. */
export function reserveInventoryStatements(
  orderId: SqlFragment,
  items: CartItem[],
  enabled: boolean
): SqlFragment[] {
  // Finished goods always require an explicit stock count. Existing customizable
  // blanks continue to follow the shop-wide inventory setting.
  const stockItems = enabled ? items : items.filter((item) => item.saleMode === "ready-made");
  if (!stockItems.length) return [];

  const grouped = new Map<string, Variant>();
  for (const item of stockItems) {
    for (const line of item.lines) {
      if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new InsufficientStockError();
      const key = JSON.stringify([item.productId, item.colorName, line.label]);
      const row = grouped.get(key) ?? { productId: item.productId, color: item.colorName, size: line.label, quantity: 0 };
      row.quantity += line.qty;
      grouped.set(key, row);
    }
  }

  const rows = [...grouped.values()].sort(
    (a, b) => a.productId - b.productId || a.color.localeCompare(b.color) || a.size.localeCompare(b.size)
  );

  const statements: SqlFragment[] = [];
  for (const [index, row] of rows.entries()) {
    statements.push(sql`
      INSERT INTO inventory_reservations (order_id, product_id, color_name, size_label, quantity)
      SELECT ${orderId}, ${row.productId}, ${row.color}, ${row.size}, ${row.quantity}
      WHERE EXISTS (
        SELECT 1 FROM inventory_stock st
        WHERE st.product_id = ${row.productId}
          AND st.color_name = ${row.color}
          AND st.size_label = ${row.size}
          AND st.quantity - (
            SELECT COALESCE(sum(r.quantity), 0) FROM inventory_reservations r
            WHERE r.product_id = st.product_id
              AND r.color_name = st.color_name
              AND r.size_label = st.size_label
          ) >= ${row.quantity}
      )
      ON CONFLICT (order_id, product_id, color_name, size_label) DO NOTHING`);
    statements.push(sql`
      INSERT INTO transaction_guards (key, value)
      SELECT ${`reservation:${index}`}, 0
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory_reservations
        WHERE order_id = ${orderId}
          AND product_id = ${row.productId}
          AND color_name = ${row.color}
          AND size_label = ${row.size}
          AND quantity >= ${row.quantity}
      )`);
  }
  return statements;
}

async function reservationsFor(orderId: number): Promise<Reservation[]> {
  return sql<Reservation[]>`
    SELECT product_id, color_name, size_label, quantity FROM inventory_reservations
    WHERE order_id = ${orderId}
    ORDER BY product_id, color_name, size_label`;
}

/** Statements that turn held stock into a completed sale, removing the holds. */
export async function consumeInventoryStatements(orderId: number): Promise<SqlFragment[]> {
  const rows = await reservationsFor(orderId);
  const statements: SqlFragment[] = [];
  for (const [index, row] of rows.entries()) {
    statements.push(sql`
      UPDATE inventory_stock
      SET quantity = quantity - ${row.quantity},
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE product_id = ${row.product_id}
        AND color_name = ${row.color_name}
        AND size_label = ${row.size_label}
        AND quantity >= ${row.quantity}`);
    statements.push(sql`
      INSERT INTO transaction_guards (key, value)
      SELECT ${`stock:${index}`}, 0
      WHERE changes() <> 1`);
    statements.push(sql`
      INSERT INTO inventory_adjustments
        (product_id, product_name, color_name, size_label, previous_quantity, new_quantity)
      SELECT st.product_id, p.name, st.color_name, st.size_label, st.quantity + ${row.quantity}, st.quantity
      FROM inventory_stock st
      JOIN products p ON p.id = st.product_id
      WHERE st.product_id = ${row.product_id}
        AND st.color_name = ${row.color_name}
        AND st.size_label = ${row.size_label}`);
  }
  if (rows.length) {
    statements.push(sql`DELETE FROM inventory_reservations WHERE order_id = ${orderId}`);
  }
  return statements;
}

/** Statements that drop the holds. Safe to repeat: deleting holds is idempotent. */
export async function releaseInventoryStatements(orderId: number): Promise<SqlFragment[]> {
  const rows = await reservationsFor(orderId);
  if (!rows.length) return [];
  return [sql`DELETE FROM inventory_reservations WHERE order_id = ${orderId}`];
}

/** True when a batch was rolled back by a `transaction_guards` check. */
export function isGuardFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("batch_guard_failed");
}
