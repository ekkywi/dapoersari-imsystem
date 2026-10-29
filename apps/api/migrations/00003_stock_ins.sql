-- +goose Up
CREATE TABLE stock_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id),
  supplier_id UUID REFERENCES suppliers(id),
  qty NUMERIC(18,3) NOT NULL CHECK (qty > 0),
  note TEXT,
  expired_at DATE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_ins_item_id ON stock_ins (item_id);
CREATE INDEX idx_stock_ins_created_at ON stock_ins (created_at DESC);

-- Append-only ledger for every stock delta (warehouse first; kitchen later)
CREATE TABLE stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id),
  location TEXT NOT NULL CHECK (location IN ('warehouse', 'kitchen')),
  delta NUMERIC(18,3) NOT NULL,
  qty_after NUMERIC(18,3) NOT NULL CHECK (qty_after >= 0),
  reason TEXT NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_history_item_id ON stock_history (item_id);
CREATE INDEX idx_stock_history_created_at ON stock_history (created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS stock_history;
DROP TABLE IF EXISTS stock_ins;
