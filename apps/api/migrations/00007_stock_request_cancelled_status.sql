-- +goose NO TRANSACTION
-- +goose Up
ALTER TYPE stock_request_status ADD VALUE IF NOT EXISTS 'cancelled';

-- +goose Down
-- Postgres cannot drop an enum value. Leaving 'cancelled' in the type is
-- harmless once 00008 is rolled back (no column references it by default).
SELECT 1;
