package kitchen

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

func (r *Repository) ListMenus(ctx context.Context) ([]Menu, error) {
	const q = `
		SELECT id, name, is_active, created_at
		FROM menus
		ORDER BY name
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list menus: %w", err)
	}
	defer rows.Close()

	var out []Menu
	for rows.Next() {
		var m Menu
		if err := rows.Scan(&m.ID, &m.Name, &m.IsActive, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan menu: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) GetMenu(ctx context.Context, id uuid.UUID) (Menu, error) {
	const q = `
		SELECT id, name, is_active, created_at
		FROM menus
		WHERE id = $1
		LIMIT 1
	`
	var m Menu
	err := r.db.QueryRowContext(ctx, q, id).Scan(&m.ID, &m.Name, &m.IsActive, &m.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Menu{}, ErrNotFound
	}
	if err != nil {
		return Menu{}, fmt.Errorf("get menu: %w", err)
	}
	lines, err := r.ListRecipeLines(ctx, id)
	if err != nil {
		return Menu{}, err
	}
	m.Lines = lines
	return m, nil
}

func (r *Repository) ListRecipeLines(ctx context.Context, menuID uuid.UUID) ([]RecipeLine, error) {
	const q = `
		SELECT rl.id, rl.menu_id, rl.item_id, rl.qty_per_paket,
		       i.sku, i.name, u.code
		FROM recipe_lines rl
		JOIN items i ON i.id = rl.item_id
		JOIN units u ON u.id = i.unit_id
		WHERE rl.menu_id = $1
		ORDER BY i.name
	`
	rows, err := r.db.QueryContext(ctx, q, menuID)
	if err != nil {
		return nil, fmt.Errorf("list recipe lines: %w", err)
	}
	defer rows.Close()

	var out []RecipeLine
	for rows.Next() {
		var l RecipeLine
		if err := rows.Scan(
			&l.ID, &l.MenuID, &l.ItemID, &l.QtyPerPaket,
			&l.ItemSKU, &l.ItemName, &l.UnitCode,
		); err != nil {
			return nil, fmt.Errorf("scan recipe line: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Repository) CreateMenu(ctx context.Context, name string, lines []RecipeLineInput) (Menu, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Menu{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	const qMenu = `
		INSERT INTO menus (name)
		VALUES ($1)
		RETURNING id, name, is_active, created_at
	`
	var m Menu
	if err := tx.QueryRowContext(ctx, qMenu, strings.TrimSpace(name)).
		Scan(&m.ID, &m.Name, &m.IsActive, &m.CreatedAt); err != nil {
		return Menu{}, fmt.Errorf("create menu: %w", err)
	}

	if err := insertRecipeLinesTx(ctx, tx, m.ID, lines); err != nil {
		return Menu{}, err
	}

	if err := tx.Commit(); err != nil {
		return Menu{}, fmt.Errorf("commit menu: %w", err)
	}
	return r.GetMenu(ctx, m.ID)
}

func (r *Repository) UpdateMenu(ctx context.Context, id uuid.UUID, name string, isActive bool) (Menu, error) {
	const q = `
		UPDATE menus
		SET name = $2, is_active = $3
		WHERE id = $1
		RETURNING id, name, is_active, created_at
	`
	var m Menu
	err := r.db.QueryRowContext(ctx, q, id, strings.TrimSpace(name), isActive).
		Scan(&m.ID, &m.Name, &m.IsActive, &m.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Menu{}, ErrNotFound
	}
	if err != nil {
		return Menu{}, fmt.Errorf("update menu: %w", err)
	}
	return r.GetMenu(ctx, m.ID)
}

func (r *Repository) ReplaceRecipe(ctx context.Context, menuID uuid.UUID, lines []RecipeLineInput) (Menu, error) {
	if _, err := r.GetMenu(ctx, menuID); err != nil {
		return Menu{}, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Menu{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM recipe_lines WHERE menu_id = $1`, menuID); err != nil {
		return Menu{}, fmt.Errorf("clear recipe: %w", err)
	}
	if err := insertRecipeLinesTx(ctx, tx, menuID, lines); err != nil {
		return Menu{}, err
	}
	if err := tx.Commit(); err != nil {
		return Menu{}, fmt.Errorf("commit recipe: %w", err)
	}
	return r.GetMenu(ctx, menuID)
}

func insertRecipeLinesTx(ctx context.Context, tx *sql.Tx, menuID uuid.UUID, lines []RecipeLineInput) error {
	const q = `
		INSERT INTO recipe_lines (menu_id, item_id, qty_per_paket)
		VALUES ($1, $2, $3)
	`
	for _, line := range lines {
		if _, err := tx.ExecContext(ctx, q, menuID, line.ItemID, line.QtyPerPaket); err != nil {
			return fmt.Errorf("insert recipe line: %w", err)
		}
	}
	return nil
}

func (r *Repository) ItemExists(ctx context.Context, id uuid.UUID) (bool, error) {
	const q = `SELECT 1 FROM items WHERE id = $1 AND is_active = true LIMIT 1`
	var n int
	err := r.db.QueryRowContext(ctx, q, id).Scan(&n)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("item exists: %w", err)
	}
	return true, nil
}

func (r *Repository) ListKitchenStocks(ctx context.Context) ([]KitchenStock, error) {
	const q = `
		SELECT item_id, qty, updated_at
		FROM kitchen_stocks
		ORDER BY item_id
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list kitchen stocks: %w", err)
	}
	defer rows.Close()

	var out []KitchenStock
	for rows.Next() {
		var s KitchenStock
		if err := rows.Scan(&s.ItemID, &s.Qty, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan kitchen stock: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ItemMeta used when expanding recipes / snapshotting requests.
type ItemMeta struct {
	ID       uuid.UUID
	SKU      string
	Name     string
	UnitCode string
}

func (r *Repository) GetItemMeta(ctx context.Context, id uuid.UUID) (ItemMeta, error) {
	const q = `
		SELECT i.id, i.sku, i.name, u.code
		FROM items i
		JOIN units u ON u.id = i.unit_id
		WHERE i.id = $1
		LIMIT 1
	`
	var m ItemMeta
	err := r.db.QueryRowContext(ctx, q, id).Scan(&m.ID, &m.SKU, &m.Name, &m.UnitCode)
	if errors.Is(err, sql.ErrNoRows) {
		return ItemMeta{}, ErrNotFound
	}
	if err != nil {
		return ItemMeta{}, fmt.Errorf("get item meta: %w", err)
	}
	return m, nil
}
