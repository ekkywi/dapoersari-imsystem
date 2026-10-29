-- +goose Up
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  qty_per_paket NUMERIC(18,3) NOT NULL CHECK (qty_per_paket > 0),
  UNIQUE (menu_id, item_id)
);

CREATE TABLE kitchen_stocks (
  item_id UUID PRIMARY KEY REFERENCES items(id),
  qty NUMERIC(18,3) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO kitchen_stocks (item_id, qty)
SELECT id, 0 FROM items
ON CONFLICT (item_id) DO NOTHING;

CREATE TYPE stock_request_status AS ENUM (
  'submitted',
  'approved',
  'transferred',
  'received',
  'rejected'
);

CREATE TABLE stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status stock_request_status NOT NULL DEFAULT 'submitted',
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES users(id),
  transferred_at TIMESTAMPTZ,
  received_by UUID REFERENCES users(id),
  received_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  reject_reason TEXT
);

CREATE INDEX idx_stock_requests_status ON stock_requests (status);
CREATE INDEX idx_stock_requests_created_at ON stock_requests (created_at DESC);

CREATE TABLE stock_request_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES menus(id),
  menu_name TEXT NOT NULL,
  qty_paket NUMERIC(18,3) NOT NULL CHECK (qty_paket > 0)
);

CREATE TABLE stock_request_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  item_sku TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  qty NUMERIC(18,3) NOT NULL CHECK (qty > 0)
);

CREATE INDEX idx_stock_request_lines_request ON stock_request_lines (request_id);

-- +goose Down
DROP TABLE IF EXISTS stock_request_lines;
DROP TABLE IF EXISTS stock_request_packages;
DROP TABLE IF EXISTS stock_requests;
DROP TYPE IF EXISTS stock_request_status;
DROP TABLE IF EXISTS kitchen_stocks;
DROP TABLE IF EXISTS recipe_lines;
DROP TABLE IF EXISTS menus;
