-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_ecommerce.sql
-- AT Jewellers e-commerce layer: branches, customers, OTPs, cart, orders
-- Run via: Supabase dashboard → SQL Editor → paste & run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Branches ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jeweller_id uuid NOT NULL REFERENCES jewellers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  city        text NOT NULL,
  address     text NOT NULL,
  pin_code    text,
  phone       text,
  email       text,
  lat         numeric(9, 6),
  lng         numeric(9, 6),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS branches_jeweller_id_idx ON branches(jeweller_id);

-- ── Customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jeweller_id         uuid NOT NULL REFERENCES jewellers(id) ON DELETE CASCADE,
  phone               text NOT NULL,
  name                text,
  email               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jeweller_id, phone)
);
CREATE INDEX IF NOT EXISTS customers_jeweller_phone_idx ON customers(jeweller_id, phone);

-- ── Customer addresses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'Home',
  name        text NOT NULL,
  phone       text NOT NULL,
  line1       text NOT NULL,
  line2       text,
  city        text NOT NULL,
  state       text NOT NULL,
  pin_code    text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_addresses_customer_id_idx ON customer_addresses(customer_id);

-- ── Dummy OTPs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jeweller_id uuid NOT NULL REFERENCES jewellers(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  otp         text NOT NULL,
  expires_at  timestamptz NOT NULL,
  verified    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_otps_phone_idx ON customer_otps(jeweller_id, phone);

-- ── Cart items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  jeweller_id uuid NOT NULL REFERENCES jewellers(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS cart_items_customer_id_idx ON cart_items(customer_id);
CREATE INDEX IF NOT EXISTS cart_items_jeweller_id_idx ON cart_items(jeweller_id);

-- ── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jeweller_id      uuid NOT NULL REFERENCES jewellers(id) ON DELETE CASCADE,
  customer_id      uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  branch_id        uuid REFERENCES branches(id) ON DELETE SET NULL,
  order_number     text NOT NULL,
  status           text NOT NULL DEFAULT 'placed'
                     CHECK (status IN ('placed','confirmed','packed','shipped','delivered','cancelled')),
  delivery_type    text NOT NULL DEFAULT 'delivery'
                     CHECK (delivery_type IN ('delivery','click_and_collect')),
  subtotal         numeric(14, 2) NOT NULL,
  discount         numeric(14, 2) NOT NULL DEFAULT 0,
  total            numeric(14, 2) NOT NULL,
  payment_method   text NOT NULL DEFAULT 'dummy_card',
  payment_status   text NOT NULL DEFAULT 'paid',
  payment_id       text,
  -- Shipping snapshot (copied at order time so address changes don't affect history)
  shipping_name     text,
  shipping_phone    text,
  shipping_line1    text,
  shipping_line2    text,
  shipping_city     text,
  shipping_state    text,
  shipping_pin_code text,
  notes            text,
  estimated_delivery date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jeweller_id, order_number)
);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_jeweller_id_idx   ON orders(jeweller_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx    ON orders(created_at DESC);

-- ── Order items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name      text NOT NULL,
  product_slug      text NOT NULL,
  product_image_url text,
  quantity          integer NOT NULL DEFAULT 1,
  unit_price        numeric(14, 2) NOT NULL,
  total_price       numeric(14, 2) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- ── Order status history (tracking) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     text NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx ON order_status_history(order_id);

-- ── RLS (open for service-role; same pattern as existing tables) ──────────────
ALTER TABLE branches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_otps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
