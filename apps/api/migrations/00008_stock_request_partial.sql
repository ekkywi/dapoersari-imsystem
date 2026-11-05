-- +goose Up
ALTER TABLE stock_requests
  ADD COLUMN cancelled_by UUID REFERENCES users(id),
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancel_reason TEXT;

ALTER TABLE stock_request_lines
  ADD COLUMN qty_transferred NUMERIC(18,3) CHECK (qty_transferred >= 0 AND qty_transferred <= qty),
  ADD COLUMN qty_received NUMERIC(18,3) CHECK (qty_received >= 0),
  ADD COLUMN receive_note TEXT;

ALTER TABLE stock_request_lines
  ADD CONSTRAINT stock_request_lines_received_le_transferred
  CHECK (qty_received IS NULL OR (qty_transferred IS NOT NULL AND qty_received <= qty_transferred));

-- Backfill: requests already transferred/received moved the full qty.
UPDATE stock_request_lines l
SET qty_transferred = l.qty
FROM stock_requests r
WHERE r.id = l.request_id AND r.status IN ('transferred', 'received');

UPDATE stock_request_lines l
SET qty_received = l.qty
FROM stock_requests r
WHERE r.id = l.request_id AND r.status = 'received';

-- +goose Down
UPDATE stock_requests SET status = 'rejected', rejected_by = cancelled_by,
  rejected_at = cancelled_at, reject_reason = cancel_reason
WHERE status = 'cancelled';
ALTER TABLE stock_request_lines DROP CONSTRAINT IF EXISTS stock_request_lines_received_le_transferred;
ALTER TABLE stock_request_lines
  DROP COLUMN IF EXISTS receive_note,
  DROP COLUMN IF EXISTS qty_received,
  DROP COLUMN IF EXISTS qty_transferred;
ALTER TABLE stock_requests
  DROP COLUMN IF EXISTS cancel_reason,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancelled_by;
