// Package stockcheck compares required quantities against stock in one pass,
// with all arithmetic done in Postgres NUMERIC.
package stockcheck

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/google/uuid"
)

// Table is a stock table name. Only the constants below are valid.
type Table string

const (
	Warehouse Table = "warehouse_stocks"
	Kitchen   Table = "kitchen_stocks"
)

// Need is a required quantity for one item. Qty is a decimal string.
type Need struct {
	ItemID uuid.UUID
	Qty    string
}

// FormatQty renders a float quantity as a decimal string for NUMERIC casts.
func FormatQty(q float64) string {
	return strconv.FormatFloat(q, 'f', -1, 64)
}

// Line is the comparison result for one item.
type Line struct {
	ItemID     uuid.UUID   `json:"item_id"`
	SKU        string      `json:"sku"`
	Name       string      `json:"name"`
	Unit       string      `json:"unit"`
	Dibutuhkan json.Number `json:"dibutuhkan"`
	Tersedia   json.Number `json:"tersedia"`
	Kurang     json.Number `json:"kurang"`
	// Bisa is LEAST(dibutuhkan, tersedia): what can actually be moved.
	Bisa  json.Number `json:"-"`
	Short bool        `json:"-"`
}

// ShortageError carries every short line. Handlers map it to 409 + details.
type ShortageError struct {
	Lines []Line
}

func (e *ShortageError) Error() string { return "insufficient stock" }

// Shortages returns only the lines that are short.
func Shortages(lines []Line) []Line {
	var out []Line
	for _, l := range lines {
		if l.Short {
			out = append(out, l)
		}
	}
	return out
}

type querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// Lock takes row locks on the stock rows for the given items, ordered by
// item_id to avoid deadlocks. Must run inside a transaction.
func Lock(ctx context.Context, tx *sql.Tx, table Table, items []uuid.UUID) error {
	if err := table.valid(); err != nil {
		return err
	}
	rows, err := tx.QueryContext(ctx,
		`SELECT item_id FROM `+string(table)+` WHERE item_id = ANY($1::uuid[]) ORDER BY item_id FOR UPDATE`,
		idStrings(items))
	if err != nil {
		return fmt.Errorf("lock stock: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
	}
	return rows.Err()
}

// Compare evaluates all needs against stock. When reserveExcept is non-nil,
// quantities on OTHER approved (not yet transferred) stock requests are
// subtracted from availability (warehouse only).
func Compare(ctx context.Context, q querier, table Table, needs []Need, reserveExcept *uuid.UUID) ([]Line, error) {
	if err := table.valid(); err != nil {
		return nil, err
	}
	if len(needs) == 0 {
		return nil, nil
	}
	ids := make([]string, len(needs))
	qtys := make([]string, len(needs))
	for i, n := range needs {
		ids[i] = n.ItemID.String()
		qtys[i] = n.Qty
	}
	useReserve := reserveExcept != nil
	var except any
	if useReserve {
		except = reserveExcept.String()
	}
	query := `
		WITH need AS (
			SELECT t.item_id, ROUND(SUM(t.qty), 3) AS qty
			FROM unnest($1::uuid[], $2::numeric[]) AS t(item_id, qty)
			GROUP BY t.item_id
		), avail AS (
			SELECT n.item_id, n.qty AS need,
			       GREATEST(COALESCE(s.qty, 0) - CASE WHEN $4::bool THEN COALESCE((
			           SELECT SUM(l.qty)
			           FROM stock_request_lines l
			           JOIN stock_requests r ON r.id = l.request_id
			           WHERE r.status = 'approved'
			             AND l.item_id = n.item_id
			             AND r.id <> $3::uuid
			       ), 0) ELSE 0 END, 0) AS avail
			FROM need n
			LEFT JOIN ` + string(table) + ` s ON s.item_id = n.item_id
		)
		SELECT a.item_id, i.sku, i.name, u.code,
		       a.need::text, a.avail::text,
		       GREATEST(a.need - a.avail, 0)::text,
		       LEAST(a.need, a.avail)::text,
		       a.need > a.avail
		FROM avail a
		JOIN items i ON i.id = a.item_id
		JOIN units u ON u.id = i.unit_id
		ORDER BY i.name, a.item_id
	`
	rows, err := q.QueryContext(ctx, query, ids, qtys, except, useReserve)
	if err != nil {
		return nil, fmt.Errorf("compare stock: %w", err)
	}
	defer rows.Close()
	var out []Line
	for rows.Next() {
		var l Line
		var need, avail, short, bisa string
		if err := rows.Scan(&l.ItemID, &l.SKU, &l.Name, &l.Unit, &need, &avail, &short, &bisa, &l.Short); err != nil {
			return nil, fmt.Errorf("scan compare: %w", err)
		}
		l.Dibutuhkan, l.Tersedia, l.Kurang, l.Bisa = json.Number(need), json.Number(avail), json.Number(short), json.Number(bisa)
		out = append(out, l)
	}
	return out, rows.Err()
}

func (t Table) valid() error {
	if t != Warehouse && t != Kitchen {
		return fmt.Errorf("invalid stock table %q", t)
	}
	return nil
}

func idStrings(ids []uuid.UUID) []string {
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = id.String()
	}
	return out
}
