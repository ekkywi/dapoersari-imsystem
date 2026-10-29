-- +goose Up
CREATE TABLE menu_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_closings_date ON menu_closings (closing_date DESC);
CREATE INDEX idx_menu_closings_created_at ON menu_closings (created_at DESC);

CREATE TABLE menu_closing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES menu_closings(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES menus(id),
  menu_name TEXT NOT NULL,
  qty_paket NUMERIC(18,3) NOT NULL CHECK (qty_paket > 0)
);

CREATE TABLE menu_closing_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES menu_closings(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  item_sku TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  qty NUMERIC(18,3) NOT NULL CHECK (qty > 0)
);

CREATE INDEX idx_menu_closing_lines_closing ON menu_closing_lines (closing_id);

CREATE TYPE opname_status AS ENUM ('draft', 'confirmed', 'cancelled');

CREATE TABLE opnames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT NOT NULL CHECK (location IN ('warehouse', 'kitchen')),
  status opname_status NOT NULL DEFAULT 'draft',
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_opnames_location ON opnames (location);
CREATE INDEX idx_opnames_created_at ON opnames (created_at DESC);

CREATE TABLE opname_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID NOT NULL REFERENCES opnames(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  item_sku TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  system_qty NUMERIC(18,3) NOT NULL CHECK (system_qty >= 0),
  physical_qty NUMERIC(18,3) NOT NULL CHECK (physical_qty >= 0),
  UNIQUE (opname_id, item_id)
);

CREATE INDEX idx_opname_lines_opname ON opname_lines (opname_id);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_entity ON activity_logs (entity_type, entity_id);

-- +goose Down
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS opname_lines;
DROP TABLE IF EXISTS opnames;
DROP TYPE IF EXISTS opname_status;
DROP TABLE IF EXISTS menu_closing_lines;
DROP TABLE IF EXISTS menu_closing_packages;
DROP TABLE IF EXISTS menu_closings;
