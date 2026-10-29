package history

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type ListFilter struct {
	Location string
	ItemID   *uuid.UUID
	Limit    int
}

func (r *Repository) ListStock(ctx context.Context, f ListFilter) ([]StockEntry, error) {
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}

	q := `
		SELECT h.id, h.item_id, i.sku, i.name, u.code,
		       h.location, h.delta, h.qty_after, h.reason,
		       h.ref_type, h.ref_id, h.created_by, h.created_at
		FROM stock_history h
		JOIN items i ON i.id = h.item_id
		JOIN units u ON u.id = i.unit_id
		WHERE 1=1
	`
	args := []any{}
	n := 1
	if f.Location != "" {
		q += fmt.Sprintf(` AND h.location = $%d`, n)
		args = append(args, f.Location)
		n++
	}
	if f.ItemID != nil {
		q += fmt.Sprintf(` AND h.item_id = $%d`, n)
		args = append(args, *f.ItemID)
		n++
	}
	q += fmt.Sprintf(` ORDER BY h.created_at DESC LIMIT $%d`, n)
	args = append(args, f.Limit)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list stock history: %w", err)
	}
	defer rows.Close()

	var out []StockEntry
	for rows.Next() {
		var e StockEntry
		if err := rows.Scan(
			&e.ID, &e.ItemID, &e.ItemSKU, &e.ItemName, &e.UnitCode,
			&e.Location, &e.Delta, &e.QtyAfter, &e.Reason,
			&e.RefType, &e.RefID, &e.CreatedBy, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan stock history: %w", err)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
