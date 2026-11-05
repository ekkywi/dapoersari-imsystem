package kitchen

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"dapoersari-imsystem/apps/api/internal/stockcheck"

	"github.com/google/uuid"
)

type NewClosingInput struct {
	ClosingDate   time.Time
	Note          *string
	AllowShortage bool
	ShortageNote  *string
	CreatedBy     uuid.UUID
	Packages      []MenuClosingPackage
	Lines         []MenuClosingLine
}

func (r *Repository) ListClosings(ctx context.Context) ([]MenuClosing, error) {
	const q = `
		SELECT id, to_char(closing_date, 'YYYY-MM-DD'), note, shortage_note,
		       EXISTS (SELECT 1 FROM menu_closing_lines l WHERE l.closing_id = menu_closings.id AND l.shortage_qty > 0),
		       created_by, created_at
		FROM menu_closings
		ORDER BY closing_date DESC, created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list closings: %w", err)
	}
	defer rows.Close()

	var out []MenuClosing
	for rows.Next() {
		var c MenuClosing
		if err := rows.Scan(&c.ID, &c.ClosingDate, &c.Note, &c.ShortageNote, &c.HasShortage, &c.CreatedBy, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan closing: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repository) GetClosing(ctx context.Context, id uuid.UUID) (MenuClosing, error) {
	const q = `
		SELECT id, to_char(closing_date, 'YYYY-MM-DD'), note, shortage_note,
		       EXISTS (SELECT 1 FROM menu_closing_lines l WHERE l.closing_id = menu_closings.id AND l.shortage_qty > 0),
		       created_by, created_at
		FROM menu_closings
		WHERE id = $1
		LIMIT 1
	`
	var c MenuClosing
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&c.ID, &c.ClosingDate, &c.Note, &c.ShortageNote, &c.HasShortage, &c.CreatedBy, &c.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return MenuClosing{}, ErrNotFound
	}
	if err != nil {
		return MenuClosing{}, fmt.Errorf("get closing: %w", err)
	}

	pkgs, err := r.listClosingPackages(ctx, id)
	if err != nil {
		return MenuClosing{}, err
	}
	lines, err := r.listClosingLines(ctx, id)
	if err != nil {
		return MenuClosing{}, err
	}
	c.Packages = pkgs
	c.Lines = lines
	return c, nil
}

func (r *Repository) listClosingPackages(ctx context.Context, closingID uuid.UUID) ([]MenuClosingPackage, error) {
	const q = `
		SELECT id, closing_id, menu_id, menu_name, qty_paket
		FROM menu_closing_packages
		WHERE closing_id = $1
		ORDER BY menu_name
	`
	rows, err := r.db.QueryContext(ctx, q, closingID)
	if err != nil {
		return nil, fmt.Errorf("list closing packages: %w", err)
	}
	defer rows.Close()

	var out []MenuClosingPackage
	for rows.Next() {
		var p MenuClosingPackage
		if err := rows.Scan(&p.ID, &p.ClosingID, &p.MenuID, &p.MenuName, &p.QtyPaket); err != nil {
			return nil, fmt.Errorf("scan closing package: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) listClosingLines(ctx context.Context, closingID uuid.UUID) ([]MenuClosingLine, error) {
	const q = `
		SELECT id, closing_id, item_id, item_sku, item_name, unit_code, qty, shortage_qty
		FROM menu_closing_lines
		WHERE closing_id = $1
		ORDER BY item_name
	`
	rows, err := r.db.QueryContext(ctx, q, closingID)
	if err != nil {
		return nil, fmt.Errorf("list closing lines: %w", err)
	}
	defer rows.Close()

	var out []MenuClosingLine
	for rows.Next() {
		var l MenuClosingLine
		if err := rows.Scan(&l.ID, &l.ClosingID, &l.ItemID, &l.ItemSKU, &l.ItemName, &l.UnitCode, &l.Qty, &l.ShortageQty); err != nil {
			return nil, fmt.Errorf("scan closing line: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// CreateClosingAndConsume inserts closing snapshot, decreases kitchen stock, writes history.
// Stock rows are locked (ordered by item_id) and compared ONCE up front. If any
// line is short the whole closing is rejected with every short line, unless
// AllowShortage is set: then each line deducts what is available and records
// the remainder as shortage_qty.
func (r *Repository) CreateClosingAndConsume(ctx context.Context, in NewClosingInput) (MenuClosing, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return MenuClosing{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	ids := make([]uuid.UUID, 0, len(in.Lines))
	needs := make([]stockcheck.Need, 0, len(in.Lines))
	for _, l := range in.Lines {
		ids = append(ids, l.ItemID)
		needs = append(needs, stockcheck.Need{ItemID: l.ItemID, Qty: stockcheck.FormatQty(l.Qty)})
	}
	if err := stockcheck.Lock(ctx, tx, stockcheck.Kitchen, ids); err != nil {
		return MenuClosing{}, err
	}
	checked, err := stockcheck.Compare(ctx, tx, stockcheck.Kitchen, needs, nil)
	if err != nil {
		return MenuClosing{}, err
	}
	short := stockcheck.Shortages(checked)
	if len(short) > 0 && !in.AllowShortage {
		return MenuClosing{}, &stockcheck.ShortageError{Lines: short}
	}
	withShortage := len(short) > 0

	var shortageNote *string
	if withShortage {
		shortageNote = in.ShortageNote
	}

	const qClose = `
		INSERT INTO menu_closings (closing_date, note, created_by, shortage_note)
		VALUES ($1, $2, $3, $4)
		RETURNING id, to_char(closing_date, 'YYYY-MM-DD'), note, created_by, created_at
	`
	var c MenuClosing
	if err := tx.QueryRowContext(ctx, qClose, in.ClosingDate, in.Note, in.CreatedBy, shortageNote).Scan(
		&c.ID, &c.ClosingDate, &c.Note, &c.CreatedBy, &c.CreatedAt,
	); err != nil {
		return MenuClosing{}, fmt.Errorf("insert closing: %w", err)
	}

	const qPkg = `
		INSERT INTO menu_closing_packages (closing_id, menu_id, menu_name, qty_paket)
		VALUES ($1, $2, $3, $4)
	`
	for _, p := range in.Packages {
		if _, err := tx.ExecContext(ctx, qPkg, c.ID, p.MenuID, p.MenuName, p.QtyPaket); err != nil {
			return MenuClosing{}, fmt.Errorf("insert closing package: %w", err)
		}
	}

	meta := make(map[uuid.UUID]MenuClosingLine, len(in.Lines))
	for _, l := range in.Lines {
		meta[l.ItemID] = l
	}

	for _, chk := range checked {
		l := meta[chk.ItemID]
		// qty = full recipe need; shortage_qty = what could not be deducted.
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO menu_closing_lines (closing_id, item_id, item_sku, item_name, unit_code, qty, shortage_qty)
			VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric)
		`, c.ID, l.ItemID, l.ItemSKU, l.ItemName, l.UnitCode, string(chk.Dibutuhkan), string(chk.Kurang)); err != nil {
			return MenuClosing{}, fmt.Errorf("insert closing line: %w", err)
		}

		var qtyAfter string
		var deducted string
		err := tx.QueryRowContext(ctx, `
			UPDATE kitchen_stocks
			SET qty = qty - $2::numeric, updated_at = now()
			WHERE item_id = $1 AND qty >= $2::numeric AND $2::numeric > 0
			RETURNING qty::text, $2::numeric::text
		`, l.ItemID, string(chk.Bisa)).Scan(&qtyAfter, &deducted)
		if errors.Is(err, sql.ErrNoRows) {
			// Nothing available to deduct (only reachable with AllowShortage).
			continue
		}
		if err != nil {
			return MenuClosing{}, fmt.Errorf("decrease kitchen: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO stock_history (
				item_id, location, delta, qty_after, reason, ref_type, ref_id, created_by
			) VALUES ($1, 'kitchen', -($2::numeric), $3::numeric, 'menu_closing', 'menu_closing', $4, $5)
		`, l.ItemID, deducted, qtyAfter, c.ID, in.CreatedBy); err != nil {
			return MenuClosing{}, fmt.Errorf("history closing: %w", err)
		}
	}

	action, detail := "menu_closing.create", fmt.Sprintf("closing_date=%s", c.ClosingDate)
	if withShortage {
		action = "menu_closing.create_with_shortage"
		detail = fmt.Sprintf("closing_date=%s items_short=%d note=%s", c.ClosingDate, len(short), deref(shortageNote))
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, detail)
		VALUES ($1, $2, 'menu_closing', $3, $4)
	`, in.CreatedBy, action, c.ID, detail); err != nil {
		return MenuClosing{}, fmt.Errorf("activity closing: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return MenuClosing{}, fmt.Errorf("commit closing: %w", err)
	}
	return r.GetClosing(ctx, c.ID)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
