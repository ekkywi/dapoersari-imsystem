package opname

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type ItemSnap struct {
	ItemID   uuid.UUID
	SKU      string
	Name     string
	UnitCode string
	Qty      float64
}

func (r *Repository) GetWarehouseSnap(ctx context.Context, itemID uuid.UUID) (ItemSnap, error) {
	const q = `
		SELECT i.id, i.sku, i.name, u.code, COALESCE(ws.qty, 0)
		FROM items i
		JOIN units u ON u.id = i.unit_id
		LEFT JOIN warehouse_stocks ws ON ws.item_id = i.id
		WHERE i.id = $1
		LIMIT 1
	`
	var s ItemSnap
	err := r.db.QueryRowContext(ctx, q, itemID).Scan(&s.ItemID, &s.SKU, &s.Name, &s.UnitCode, &s.Qty)
	if errors.Is(err, sql.ErrNoRows) {
		return ItemSnap{}, ErrNotFound
	}
	if err != nil {
		return ItemSnap{}, fmt.Errorf("warehouse snap: %w", err)
	}
	return s, nil
}

func (r *Repository) GetKitchenSnap(ctx context.Context, itemID uuid.UUID) (ItemSnap, error) {
	const q = `
		SELECT i.id, i.sku, i.name, u.code, COALESCE(ks.qty, 0)
		FROM items i
		JOIN units u ON u.id = i.unit_id
		LEFT JOIN kitchen_stocks ks ON ks.item_id = i.id
		WHERE i.id = $1
		LIMIT 1
	`
	var s ItemSnap
	err := r.db.QueryRowContext(ctx, q, itemID).Scan(&s.ItemID, &s.SKU, &s.Name, &s.UnitCode, &s.Qty)
	if errors.Is(err, sql.ErrNoRows) {
		return ItemSnap{}, ErrNotFound
	}
	if err != nil {
		return ItemSnap{}, fmt.Errorf("kitchen snap: %w", err)
	}
	return s, nil
}

type NewOpnameInput struct {
	Location  string
	Note      *string
	CreatedBy uuid.UUID
	Lines     []OpnameLine
}

func (r *Repository) CreateDraft(ctx context.Context, in NewOpnameInput) (Opname, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Opname{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	const qHead = `
		INSERT INTO opnames (location, status, note, created_by)
		VALUES ($1, 'draft', $2, $3)
		RETURNING id, location, status::text, note, created_by, created_at, confirmed_by, confirmed_at
	`
	var o Opname
	if err := tx.QueryRowContext(ctx, qHead, in.Location, in.Note, in.CreatedBy).Scan(
		&o.ID, &o.Location, &o.Status, &o.Note, &o.CreatedBy, &o.CreatedAt, &o.ConfirmedBy, &o.ConfirmedAt,
	); err != nil {
		return Opname{}, fmt.Errorf("insert opname: %w", err)
	}

	const qLine = `
		INSERT INTO opname_lines (
			opname_id, item_id, item_sku, item_name, unit_code, system_qty, physical_qty
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	for _, l := range in.Lines {
		if _, err := tx.ExecContext(ctx, qLine,
			o.ID, l.ItemID, l.ItemSKU, l.ItemName, l.UnitCode, l.SystemQty, l.PhysicalQty,
		); err != nil {
			return Opname{}, fmt.Errorf("insert opname line: %w", err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, detail)
		VALUES ($1, 'opname.create_draft', 'opname', $2, $3)
	`, in.CreatedBy, o.ID, "location="+in.Location); err != nil {
		return Opname{}, fmt.Errorf("activity opname: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Opname{}, fmt.Errorf("commit opname: %w", err)
	}
	return r.Get(ctx, o.ID)
}

func (r *Repository) List(ctx context.Context, location string) ([]Opname, error) {
	q := `
		SELECT id, location, status::text, note, created_by, created_at, confirmed_by, confirmed_at
		FROM opnames
	`
	args := []any{}
	if location != "" {
		q += ` WHERE location = $1`
		args = append(args, location)
	}
	q += ` ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list opnames: %w", err)
	}
	defer rows.Close()

	var out []Opname
	for rows.Next() {
		var o Opname
		if err := rows.Scan(
			&o.ID, &o.Location, &o.Status, &o.Note, &o.CreatedBy, &o.CreatedAt, &o.ConfirmedBy, &o.ConfirmedAt,
		); err != nil {
			return nil, fmt.Errorf("scan opname: %w", err)
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (Opname, error) {
	const q = `
		SELECT id, location, status::text, note, created_by, created_at, confirmed_by, confirmed_at
		FROM opnames
		WHERE id = $1
		LIMIT 1
	`
	var o Opname
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&o.ID, &o.Location, &o.Status, &o.Note, &o.CreatedBy, &o.CreatedAt, &o.ConfirmedBy, &o.ConfirmedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Opname{}, ErrNotFound
	}
	if err != nil {
		return Opname{}, fmt.Errorf("get opname: %w", err)
	}
	lines, err := r.listLines(ctx, id)
	if err != nil {
		return Opname{}, err
	}
	o.Lines = lines
	return o, nil
}

func (r *Repository) listLines(ctx context.Context, opnameID uuid.UUID) ([]OpnameLine, error) {
	const q = `
		SELECT l.id, l.opname_id, l.item_id, l.item_sku, l.item_name, l.unit_code, c.name,
		       l.system_qty, l.physical_qty
		FROM opname_lines l
		LEFT JOIN items i ON i.id = l.item_id
		LEFT JOIN categories c ON c.id = i.category_id
		WHERE l.opname_id = $1
		ORDER BY l.item_name
	`
	rows, err := r.db.QueryContext(ctx, q, opnameID)
	if err != nil {
		return nil, fmt.Errorf("list opname lines: %w", err)
	}
	defer rows.Close()

	var out []OpnameLine
	for rows.Next() {
		var l OpnameLine
		if err := rows.Scan(
			&l.ID, &l.OpnameID, &l.ItemID, &l.ItemSKU, &l.ItemName, &l.UnitCode, &l.CategoryName,
			&l.SystemQty, &l.PhysicalQty,
		); err != nil {
			return nil, fmt.Errorf("scan opname line: %w", err)
		}
		l.Variance = l.PhysicalQty - l.SystemQty
		out = append(out, l)
	}
	return out, rows.Err()
}

func (r *Repository) Confirm(ctx context.Context, o Opname, actor uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx, `
		UPDATE opnames
		SET status = 'confirmed', confirmed_by = $2, confirmed_at = now()
		WHERE id = $1 AND status = 'draft'
	`, o.ID, actor)
	if err != nil {
		return fmt.Errorf("mark confirmed: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrConflict
	}

	for _, line := range o.Lines {
		delta := line.PhysicalQty - line.SystemQty
		if delta == 0 {
			continue
		}
		var table string
		switch o.Location {
		case LocationWarehouse:
			table = "warehouse_stocks"
		case LocationKitchen:
			table = "kitchen_stocks"
		default:
			return fmt.Errorf("unknown location")
		}

		// Apply the counted variance to the CURRENT stock, not overwrite it with
		// the physical count: movements (stock-in, transfer, closing) that happened
		// between drafting and confirming must be preserved.
		var current float64
		err = tx.QueryRowContext(ctx,
			`SELECT qty FROM `+table+` WHERE item_id = $1 FOR UPDATE`,
			line.ItemID).Scan(&current)
		if errors.Is(err, sql.ErrNoRows) {
			current, err = 0, nil
		}
		if err != nil {
			return fmt.Errorf("lock stock: %w", err)
		}
		qtyAfter := current + delta
		if qtyAfter < 0 {
			qtyAfter = 0
		}
		delta = qtyAfter - current
		if delta == 0 {
			continue
		}
		if _, err = tx.ExecContext(ctx, `
			INSERT INTO `+table+` (item_id, qty, updated_at)
			VALUES ($1, $2, now())
			ON CONFLICT (item_id) DO UPDATE
			SET qty = EXCLUDED.qty, updated_at = now()
		`, line.ItemID, qtyAfter); err != nil {
			return fmt.Errorf("adjust stock: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO stock_history (
				item_id, location, delta, qty_after, reason, ref_type, ref_id, created_by
			) VALUES ($1, $2, $3, $4, 'opname_adjust', 'opname', $5, $6)
		`, line.ItemID, o.Location, delta, qtyAfter, o.ID, actor); err != nil {
			return fmt.Errorf("history opname: %w", err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, detail)
		VALUES ($1, 'opname.confirm', 'opname', $2, $3)
	`, actor, o.ID, "location="+o.Location); err != nil {
		return fmt.Errorf("activity confirm: %w", err)
	}

	return tx.Commit()
}

// HasClosingToday reports whether a menu closing exists for today (Asia/Jakarta).
func (r *Repository) HasClosingToday(ctx context.Context) (bool, error) {
	var ok bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM menu_closings
			WHERE closing_date = (now() AT TIME ZONE 'Asia/Jakarta')::date
		)
	`).Scan(&ok)
	if err != nil {
		return false, fmt.Errorf("closing today: %w", err)
	}
	return ok, nil
}

// CountClosingsSince counts menu closings recorded after t (the draft snapshot).
func (r *Repository) CountClosingsSince(ctx context.Context, t time.Time) (int, error) {
	var n int
	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM menu_closings WHERE created_at > $1`, t).Scan(&n); err != nil {
		return 0, fmt.Errorf("closings since: %w", err)
	}
	return n, nil
}
