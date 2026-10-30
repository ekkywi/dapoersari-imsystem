package dashboard

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

func (r *Repository) CountRequestsByStatus(ctx context.Context, status string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM stock_requests WHERE status = $1
	`, status).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count requests: %w", err)
	}
	return n, nil
}

func (r *Repository) CountActiveItems(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM items WHERE is_active = true
	`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count items: %w", err)
	}
	return n, nil
}

func (r *Repository) CountActiveMenus(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM menus WHERE is_active = true
	`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count menus: %w", err)
	}
	return n, nil
}

func (r *Repository) ListWarehouseLowStock(ctx context.Context) ([]LowStockAlert, error) {
	const q = `
		SELECT i.id, i.sku, i.name, u.code, c.name, COALESCE(ws.qty, 0), i.min_stock
		FROM items i
		JOIN units u ON u.id = i.unit_id
		LEFT JOIN categories c ON c.id = i.category_id
		LEFT JOIN warehouse_stocks ws ON ws.item_id = i.id
		WHERE i.is_active = true
		  AND COALESCE(ws.qty, 0) <= i.min_stock
		ORDER BY COALESCE(ws.qty, 0) ASC, i.name
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list warehouse low stock: %w", err)
	}
	defer rows.Close()

	var out []LowStockAlert
	for rows.Next() {
		var a LowStockAlert
		if err := rows.Scan(
			&a.ItemID, &a.SKU, &a.Name, &a.UnitCode, &a.CategoryName, &a.Qty, &a.MinStock,
		); err != nil {
			return nil, fmt.Errorf("scan warehouse alert: %w", err)
		}
		a.Location = "warehouse"
		a.InTransit = 0
		a.EffectiveQty = a.Qty
		a.Level = levelFor(a.EffectiveQty, a.MinStock)
		out = append(out, a)
	}
	return out, rows.Err()
}

// inTransitByItem: qty on transferred (not yet received) stock requests — heading to kitchen.
func (r *Repository) inTransitByItem(ctx context.Context) (map[uuid.UUID]float64, error) {
	const q = `
		SELECT l.item_id, COALESCE(SUM(l.qty), 0)
		FROM stock_request_lines l
		JOIN stock_requests r ON r.id = l.request_id
		WHERE r.status = 'transferred'
		GROUP BY l.item_id
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("in-transit: %w", err)
	}
	defer rows.Close()

	out := map[uuid.UUID]float64{}
	for rows.Next() {
		var id uuid.UUID
		var qty float64
		if err := rows.Scan(&id, &qty); err != nil {
			return nil, fmt.Errorf("scan in-transit: %w", err)
		}
		out[id] = qty
	}
	return out, rows.Err()
}

func (r *Repository) ListKitchenLowStock(ctx context.Context) ([]LowStockAlert, error) {
	transit, err := r.inTransitByItem(ctx)
	if err != nil {
		return nil, err
	}

	const q = `
		SELECT i.id, i.sku, i.name, u.code, c.name, COALESCE(ks.qty, 0), i.min_stock
		FROM items i
		JOIN units u ON u.id = i.unit_id
		LEFT JOIN categories c ON c.id = i.category_id
		LEFT JOIN kitchen_stocks ks ON ks.item_id = i.id
		WHERE i.is_active = true
		ORDER BY i.name
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list kitchen stocks for alerts: %w", err)
	}
	defer rows.Close()

	var out []LowStockAlert
	for rows.Next() {
		var a LowStockAlert
		if err := rows.Scan(
			&a.ItemID, &a.SKU, &a.Name, &a.UnitCode, &a.CategoryName, &a.Qty, &a.MinStock,
		); err != nil {
			return nil, fmt.Errorf("scan kitchen alert: %w", err)
		}
		a.Location = "kitchen"
		a.InTransit = transit[a.ItemID]
		a.EffectiveQty = a.Qty + a.InTransit
		if a.EffectiveQty > a.MinStock {
			continue
		}
		a.Level = levelFor(a.EffectiveQty, a.MinStock)
		out = append(out, a)
	}
	return out, rows.Err()
}

func levelFor(effective, minStock float64) string {
	if effective <= 0 {
		return "critical"
	}
	if minStock > 0 && effective <= minStock*0.5 {
		return "critical"
	}
	return "low"
}
