-- Kingdom Custom Print — SQLite (Cloudflare D1) schema
--
-- Mirrors the shape of the original Postgres schema. Conventions:
--   * timestamps are ISO-8601 UTC text, so they sort lexicographically and
--     parse with `new Date(value)` in the app
--   * booleans are 0/1 integers
--   * jsonb columns are JSON text, parsed by the query layer
--   * bytea columns are BLOBs

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  style_code         TEXT NOT NULL DEFAULT '',
  category_id        INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('tee','polo','longsleeve','hoodie','crew','cap','mug','tote','other')),
  sale_mode          TEXT NOT NULL DEFAULT 'customizable',
  blurb              TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  material           TEXT NOT NULL DEFAULT '',
  base_price         REAL NOT NULL CHECK (base_price >= 0),
  compare_at         REAL CHECK (compare_at IS NULL OR compare_at >= base_price),
  print_fee_per_side REAL NOT NULL DEFAULT 0 CHECK (print_fee_per_side >= 0),
  print_area         TEXT NOT NULL DEFAULT '{"frontW":0.42,"frontH":0.5,"backW":0.62,"backH":0.66}',
  featured           INTEGER NOT NULL DEFAULT 0,
  active             INTEGER NOT NULL DEFAULT 1,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS products_active_idx ON products (active, sort_order);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products (featured) WHERE featured = 1;

CREATE TABLE IF NOT EXISTS product_colors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  -- Hex format is validated by the admin API; GLOB patterns are rejected by D1.
  hex         TEXT NOT NULL CHECK (length(hex) = 7),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  front_image TEXT,
  back_image  TEXT,
  UNIQUE (product_id, slug)
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  surcharge  REAL NOT NULL DEFAULT 0 CHECK (surcharge >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);

CREATE TABLE IF NOT EXISTS catalog_media (
  id           TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  content      BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS inventory_stock (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  size_label TEXT NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (product_id, color_name, size_label)
);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  color_name        TEXT NOT NULL,
  size_label        TEXT NOT NULL,
  previous_quantity INTEGER,
  new_quantity      INTEGER NOT NULL CHECK (new_quantity >= 0),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS inventory_adjustments_product_idx ON inventory_adjustments (product_id, id DESC);

CREATE TABLE IF NOT EXISTS price_breaks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty    INTEGER NOT NULL CHECK (min_qty > 0),
  amount_off REAL NOT NULL DEFAULT 0,
  UNIQUE (product_id, min_qty)
);

CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  alt        TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payment_credentials (
  name       TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_quotes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name  TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  lines          TEXT NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  status         TEXT NOT NULL DEFAULT 'quote' CHECK (status IN ('quote','invoice')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  invoiced_at    TEXT
);

CREATE TABLE IF NOT EXISTS invoice_share_tokens (
  token_hash TEXT PRIMARY KEY,
  quote_id   INTEGER NOT NULL REFERENCES admin_quotes(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS invoice_share_tokens_quote_idx ON invoice_share_tokens (quote_id);

CREATE TABLE IF NOT EXISTS quote_share_tokens (
  token_hash TEXT PRIMARY KEY,
  quote_id   INTEGER NOT NULL REFERENCES admin_quotes(id) ON DELETE CASCADE,
  snapshot   TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS quote_share_tokens_quote_idx ON quote_share_tokens (quote_id);

CREATE TABLE IF NOT EXISTS invoice_payment_attempts (
  id            TEXT PRIMARY KEY,
  quote_id      INTEGER NOT NULL REFERENCES admin_quotes(id),
  provider      TEXT NOT NULL CHECK (provider IN ('stripe','paypal')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  state         TEXT NOT NULL DEFAULT 'creating' CHECK (state IN ('creating','open','paid','closed','refunded')),
  provider_id   TEXT UNIQUE,
  payment_id    TEXT,
  checkout_url  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at       TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_payment_one_live ON invoice_payment_attempts (quote_id)
  WHERE state IN ('creating','open','paid','refunded');

CREATE TABLE IF NOT EXISTS customer_accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  google_sub     TEXT,
  email_verified INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_google_sub_idx ON customer_accounts (google_sub)
  WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_email_verifications (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_email_verifications_account_idx ON customer_email_verifications (account_id);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_sessions_account_idx ON customer_sessions (account_id);

CREATE TABLE IF NOT EXISTS customer_auth_attempts (
  key      TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  reference              TEXT NOT NULL UNIQUE,
  customer_id            INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  account_id             INTEGER REFERENCES customer_accounts(id) ON DELETE SET NULL,
  email                  TEXT NOT NULL,
  name                   TEXT NOT NULL,
  phone                  TEXT NOT NULL DEFAULT '',
  address_line1          TEXT NOT NULL DEFAULT '',
  address_line2          TEXT NOT NULL DEFAULT '',
  city                   TEXT NOT NULL DEFAULT '',
  region                 TEXT NOT NULL DEFAULT '',
  postal                 TEXT NOT NULL DEFAULT '',
  country                TEXT NOT NULL DEFAULT 'US',
  notes                  TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','paid','in_proof','in_production','shipped','refunded','cancelled')),
  subtotal               REAL NOT NULL DEFAULT 0,
  shipping               REAL NOT NULL DEFAULT 0,
  total                  REAL NOT NULL DEFAULT 0,
  stripe_session_id      TEXT,
  stripe_payment_intent  TEXT,
  paypal_order_id        TEXT,
  paypal_capture_id      TEXT,
  checkout_attempt_id    TEXT,
  inventory_provider_closed INTEGER NOT NULL DEFAULT 0,
  paid_at                TEXT,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_idx ON orders (paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_capture_idx ON orders (paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_attempt_idx ON orders (checkout_attempt_id) WHERE checkout_attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_account_idx ON orders (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_email_receipts (
  reference   TEXT PRIMARY KEY REFERENCES orders(reference) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS order_business_notifications (
  reference   TEXT PRIMARY KEY REFERENCES orders(reference) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS support_conversations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_token_hash TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now','+90 days'))
);

CREATE TABLE IF NOT EXISTS support_reply_tokens (
  token_hash      TEXT PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  audience        TEXT NOT NULL DEFAULT 'owner' CHECK (audience IN ('owner','customer')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS support_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL CHECK (sender IN ('customer','business')),
  body            TEXT NOT NULL,
  provider_event_id TEXT UNIQUE,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS support_messages_conversation_idx ON support_messages (conversation_id, id);

CREATE TABLE IF NOT EXISTS order_access_sessions (
  token_hash TEXT PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS order_access_sessions_order_idx ON order_access_sessions (order_id, expires_at);

CREATE TABLE IF NOT EXISTS order_access_attempts (
  key      TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_status_events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status       TEXT,
  to_status         TEXT NOT NULL,
  actor             TEXT NOT NULL CHECK (actor IN ('stripe','admin','system')),
  note              TEXT NOT NULL DEFAULT '',
  external_event_id TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS order_status_events_external_idx ON order_status_events (external_event_id)
  WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_status_events_order_idx ON order_status_events (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name   TEXT NOT NULL,
  product_kind   TEXT NOT NULL DEFAULT 'tee',
  sale_mode      TEXT NOT NULL DEFAULT 'customizable',
  color_name     TEXT NOT NULL DEFAULT '',
  color_hex      TEXT NOT NULL DEFAULT '',
  unit_price     REAL NOT NULL DEFAULT 0,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  size_breakdown TEXT NOT NULL DEFAULT '[]',
  design         TEXT NOT NULL DEFAULT '{"front":[],"back":[]}',
  preview_front  TEXT,
  preview_back   TEXT,
  roster         TEXT NOT NULL DEFAULT '[]',
  notes          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS inventory_control (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1
);
INSERT INTO inventory_control (id, enabled) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS inventory_reservations (
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL,
  color_name TEXT NOT NULL,
  size_label TEXT NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (order_id, product_id, color_name, size_label),
  FOREIGN KEY (product_id, color_name, size_label)
    REFERENCES inventory_stock (product_id, color_name, size_label) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS inventory_reservations_variant_idx ON inventory_reservations (product_id, color_name, size_label);

-- Checked inserts used to abort a batch when a condition is not met. A row is
-- only ever inserted with value 0, which the CHECK rejects, rolling the batch
-- back. SQLite has no RAISE outside triggers, so this stands in for one.
CREATE TABLE IF NOT EXISTS transaction_guards (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  -- Named so the failure is recognisable in both Node's SQLite and D1.
  CONSTRAINT batch_guard_failed CHECK (value = 1)
);

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Pages built in the visual editor. The draft is what an owner is editing;
-- the published snapshot is what visitors see. Scoped by slug.
CREATE TABLE IF NOT EXISTS builder_pages (
  slug           TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  show_title     INTEGER NOT NULL DEFAULT 1,
  layout_json    TEXT NOT NULL,
  revision       INTEGER NOT NULL DEFAULT 1,
  published_json TEXT,
  published_at   TEXT,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cutout_bridge_images (
  id           TEXT PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  bytes        BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS cutout_bridge_images_created_idx ON cutout_bridge_images (created_at);

-- Keep updated_at current on edits without an application-side helper.
CREATE TRIGGER IF NOT EXISTS products_touch
AFTER UPDATE OF name, slug, style_code, category_id, kind, sale_mode, blurb, description, material,
  base_price, compare_at, print_fee_per_side, print_area, featured, active, sort_order ON products
FOR EACH ROW
BEGIN
  UPDATE products SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS orders_touch
AFTER UPDATE OF status, subtotal, shipping, total, name, email, phone, address_line1, city, region,
  postal, country, notes, paid_at ON orders
FOR EACH ROW
BEGIN
  UPDATE orders SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;
