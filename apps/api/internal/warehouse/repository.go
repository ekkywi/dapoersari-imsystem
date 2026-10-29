package warehouse

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// Units
func (r *Repository) ListUnits(ctx context.Context) ([]Unit, error) {
	const q = `
		SELECT id, code, name, created_at
		FROM units
		ORDER BY code
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list units: %w", err)
	}
	defer rows.Close()

	var out []Unit
	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.Code, &u.Name, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan unit: %w", err)
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *Repository) CreateUnit(ctx context.Context, code, name string) (Unit, error) {
	const q = `
		INSERT INTO units (code, name)
		VALUES ($1, $2)
		RETURNING id, code, name, created_at
	`
	var u Unit
	err := r.db.QueryRowContext(ctx, q, strings.TrimSpace(code), strings.TrimSpace(name)).
		Scan(&u.ID, &u.Code, &u.Name, &u.CreatedAt)
	if err != nil {
		return Unit{}, fmt.Errorf("create unit: %w", err)
	}
	return u, nil
}

// Categories
func (r *Repository) ListCategories(ctx context.Context) ([]Category, error) {
	const q = `
		SELECT id, name, created_at
		FROM categories
		ORDER BY name
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list categories: %w", err)
	}
	defer rows.Close()

	var out []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repository) CreateCategory(ctx context.Context, name string) (Category, error) {
	const q = `
		INSERT INTO categories (name)
		VALUES ($1)
		RETURNING id, name, created_at
	`
	var c Category
	err := r.db.QueryRowContext(ctx, q, strings.TrimSpace(name)).
		Scan(&c.ID, &c.Name, &c.CreatedAt)
	if err != nil {
		return Category{}, fmt.Errorf("create category: %w", err)
	}
	return c, nil
}

// Suppliers
func (r *Repository) ListSuppliers(ctx context.Context) ([]Supplier, error) {
	const q = `
		SELECT id, name, phone, note, is_active, created_at
		FROM suppliers
		ORDER BY name
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list suppliers: %w", err)
	}
	defer rows.Close()

	var out []Supplier
	for rows.Next() {
		var s Supplier
		if err := rows.Scan(&s.ID, &s.Name, &s.Phone, &s.Note, &s.IsActive, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan supplier: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repository) CreateSupplier(ctx context.Context, name string, phone, note *string) (Supplier, error) {
	const q = `
		INSERT INTO suppliers (name, phone, note)
		VALUES ($1, $2, $3)
		RETURNING id, name, phone, note, is_active, created_at
	`
	var s Supplier
	err := r.db.QueryRowContext(ctx, q, strings.TrimSpace(name), phone, note).
		Scan(&s.ID, &s.Name, &s.Phone, &s.Note, &s.IsActive, &s.CreatedAt)
	if err != nil {
		return Supplier{}, fmt.Errorf("create supplier: %w", err)
	}
	return s, nil
}

// Items
func (r *Repository) ListItems(ctx context.Context) ([]Item, error) {
	const q = `
		SELECT id, sku, name, category_id, unit_id, min_stock, is_active, created_at
		FROM items
		ORDER BY name
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}
	defer rows.Close()

	var out []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(
			&it.ID, &it.SKU, &it.Name, &it.CategoryID, &it.UnitID,
			&it.MinStock, &it.IsActive, &it.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan item: %w", err)
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (r *Repository) FindItemByID(ctx context.Context, id uuid.UUID) (Item, error) {
	const q = `
		SELECT id, sku, name, category_id, unit_id, min_stock, is_active, created_at
		FROM items
		WHERE id = $1
		LIMIT 1
	`
	var it Item
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&it.ID, &it.SKU, &it.Name, &it.CategoryID, &it.UnitID,
		&it.MinStock, &it.IsActive, &it.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, fmt.Errorf("find item: %w", err)
	}
	return it, nil
}

// CreateItem inserts item + warehouse_stocks(qty=0) in one transaction.
func (r *Repository) CreateItem(ctx context.Context, it Item) (Item, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Item{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	const qItem = `
		INSERT INTO items (sku, name, category_id, unit_id, min_stock)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, sku, name, category_id, unit_id, min_stock, is_active, created_at
	`
	var created Item
	err = tx.QueryRowContext(
		ctx, qItem,
		strings.TrimSpace(it.SKU),
		strings.TrimSpace(it.Name),
		it.CategoryID,
		it.UnitID,
		it.MinStock,
	).Scan(
		&created.ID, &created.SKU, &created.Name, &created.CategoryID, &created.UnitID,
		&created.MinStock, &created.IsActive, &created.CreatedAt,
	)
	if err != nil {
		return Item{}, fmt.Errorf("create item: %w", err)
	}

	const qStock = `
		INSERT INTO warehouse_stocks (item_id, qty)
		VALUES ($1, 0)
	`
	if _, err := tx.ExecContext(ctx, qStock, created.ID); err != nil {
		return Item{}, fmt.Errorf("init warehouse stock: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Item{}, fmt.Errorf("commit create item: %w", err)
	}
	return created, nil
}

// WarehouseStock
func (r *Repository) GetWarehouseStock(ctx context.Context, itemID uuid.UUID) (WarehouseStock, error) {
	const q = `
		SELECT item_id, qty, updated_at
		FROM warehouse_stocks
		WHERE item_id = $1
		LIMIT 1
	`
	var s WarehouseStock
	err := r.db.QueryRowContext(ctx, q, itemID).Scan(&s.ItemID, &s.Qty, &s.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return WarehouseStock{}, ErrNotFound
	}
	if err != nil {
		return WarehouseStock{}, fmt.Errorf("get warehouse stock: %w", err)
	}
	return s, nil
}

func (r *Repository) ListWarehouseStocks(ctx context.Context) ([]WarehouseStock, error) {
	const q = `
		SELECT item_id, qty, updated_at
		FROM warehouse_stocks
		ORDER BY item_id
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list warehouse stocks: %w", err)
	}
	defer rows.Close()

	var out []WarehouseStock
	for rows.Next() {
		var s WarehouseStock
		if err := rows.Scan(&s.ItemID, &s.Qty, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan warehouse stock: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
