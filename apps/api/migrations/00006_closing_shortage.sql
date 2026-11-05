-- +goose Up
ALTER TABLE menu_closing_lines
  ADD COLUMN shortage_qty NUMERIC(18,3) NOT NULL DEFAULT 0 CHECK (shortage_qty >= 0);
ALTER TABLE menu_closing_lines
  ADD CONSTRAINT menu_closing_lines_shortage_le_qty CHECK (shortage_qty <= qty);
ALTER TABLE menu_closings
  ADD COLUMN shortage_note TEXT;

-- +goose Down
ALTER TABLE menu_closings DROP COLUMN IF EXISTS shortage_note;
ALTER TABLE menu_closing_lines DROP CONSTRAINT IF EXISTS menu_closing_lines_shortage_le_qty;
ALTER TABLE menu_closing_lines DROP COLUMN IF EXISTS shortage_qty;
