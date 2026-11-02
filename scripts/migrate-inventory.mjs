import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  await db.begin(async (tx) => {
    await tx`CREATE TABLE IF NOT EXISTS inventory_stock (
      product_id int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      color_name text NOT NULL, size_label text NOT NULL,
      quantity int NOT NULL CHECK (quantity >= 0), updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (product_id, color_name, size_label))`;
    await tx`CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id bigserial PRIMARY KEY, product_id int REFERENCES products(id) ON DELETE SET NULL,
      product_name text NOT NULL, color_name text NOT NULL, size_label text NOT NULL, previous_quantity int,
      new_quantity int NOT NULL CHECK (new_quantity >= 0), created_at timestamptz NOT NULL DEFAULT now())`;
    await tx`CREATE INDEX IF NOT EXISTS inventory_adjustments_product_idx ON inventory_adjustments (product_id, id DESC)`;
    await tx`ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_provider_closed boolean NOT NULL DEFAULT false`;
    await tx`CREATE TABLE IF NOT EXISTS inventory_control (id boolean PRIMARY KEY DEFAULT true CHECK (id), enabled boolean NOT NULL DEFAULT false)`;
    await tx`INSERT INTO inventory_control (id, enabled) VALUES (true, false) ON CONFLICT (id) DO NOTHING`;
    await tx`CREATE TABLE IF NOT EXISTS inventory_reservations (
      order_id int NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      product_id int NOT NULL, color_name text NOT NULL, size_label text NOT NULL,
      quantity int NOT NULL CHECK (quantity > 0), created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (order_id, product_id, color_name, size_label),
      FOREIGN KEY (product_id, color_name, size_label) REFERENCES inventory_stock (product_id, color_name, size_label) ON DELETE RESTRICT)`;
    await tx`CREATE INDEX IF NOT EXISTS inventory_reservations_variant_idx ON inventory_reservations (product_id, color_name, size_label)`;
  });
  console.log("Inventory tables are ready.");
} finally { await db.end(); }
