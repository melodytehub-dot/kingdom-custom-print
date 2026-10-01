-- Kingdom Custom Print — schema
-- Product catalog, POD design storage, orders, customers, settings.

CREATE TABLE IF NOT EXISTS categories (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order  int  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  category_id int REFERENCES categories(id) ON DELETE SET NULL,
  -- garment kind drives which customizer template renders
  kind        text NOT NULL CHECK (kind IN ('tee','longsleeve','hoodie','crew','cap','mug','tote')),
  blurb       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  -- fabric/weight spec shown on the product page
  material    text NOT NULL DEFAULT '',
  base_price  numeric(10,2) NOT NULL CHECK (base_price >= 0),
  compare_at  numeric(10,2) CHECK (compare_at IS NULL OR compare_at >= base_price),
  -- flat charge per printed side, used by the pricing engine
  print_fee_per_side numeric(10,2) NOT NULL DEFAULT 0 CHECK (print_fee_per_side >= 0),
  -- default max art width as a fraction of garment width (print area constraint)
  print_area  jsonb NOT NULL DEFAULT '{"frontW":0.42,"frontH":0.5,"backW":0.62,"backH":0.66}'::jsonb,
  featured    boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_active_idx ON products (active, sort_order);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products (featured) WHERE featured;

CREATE TABLE IF NOT EXISTS product_colors (
  id         serial PRIMARY KEY,
  product_id int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slug       text NOT NULL,
  name       text NOT NULL,
  hex        text NOT NULL CHECK (hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (product_id, slug)
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id         serial PRIMARY KEY,
  product_id int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      text NOT NULL,
  -- extra charge added per unit when this size is selected (e.g. 2XL)
  surcharge  numeric(10,2) NOT NULL DEFAULT 0 CHECK (surcharge >= 0),
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);

-- Quantity break tiers. Cheapest matching tier wins.
CREATE TABLE IF NOT EXISTS price_breaks (
  id          serial PRIMARY KEY,
  product_id  int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty     int NOT NULL CHECK (min_qty > 0),
  -- amount subtracted from base price per unit; use negative to raise price
  amount_off  numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE (product_id, min_qty)
);

CREATE TABLE IF NOT EXISTS product_images (
  id         serial PRIMARY KEY,
  product_id int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        text NOT NULL,
  alt        text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id         serial PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL DEFAULT '',
  phone      text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id             serial PRIMARY KEY,
  reference      text NOT NULL UNIQUE,
  customer_id    int REFERENCES customers(id) ON DELETE SET NULL,
  email          text NOT NULL,
  name           text NOT NULL,
  phone          text NOT NULL DEFAULT '',
  address_line1  text NOT NULL DEFAULT '',
  address_line2  text NOT NULL DEFAULT '',
  city           text NOT NULL DEFAULT '',
  region         text NOT NULL DEFAULT '',
  postal         text NOT NULL DEFAULT '',
  country        text NOT NULL DEFAULT 'US',
  notes          text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','in_proof','in_production','shipped','cancelled')),
  subtotal       numeric(10,2) NOT NULL DEFAULT 0,
  shipping       numeric(10,2) NOT NULL DEFAULT 0,
  total          numeric(10,2) NOT NULL DEFAULT 0,
  -- set once the Stripe webhook confirms payment
  stripe_session_id text,
  stripe_payment_intent text,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

-- One row per garment configuration inside an order.
CREATE TABLE IF NOT EXISTS order_items (
  id           serial PRIMARY KEY,
  order_id     int NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   int REFERENCES products(id) ON DELETE SET NULL,
  -- snapshot fields so historical orders survive catalog edits
  product_name text NOT NULL,
  product_kind text NOT NULL DEFAULT 'tee',
  color_name   text NOT NULL DEFAULT '',
  color_hex    text NOT NULL DEFAULT '',
  unit_price   numeric(10,2) NOT NULL DEFAULT 0,
  quantity     int NOT NULL CHECK (quantity > 0),
  -- size breakdown: [{ label, qty }]
  size_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- per-side design payload: { front: Layer[], back: Layer[] }
  design       jsonb NOT NULL DEFAULT '{"front":[],"back":[]}'::jsonb,
  -- data URL previews rendered at add-to-cart time
  preview_front text,
  preview_back  text,
  notes        text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token      text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_touch ON products;
CREATE TRIGGER products_touch BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS orders_touch ON orders;
CREATE TRIGGER orders_touch BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();