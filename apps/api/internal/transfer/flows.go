package transfer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"dapoersari-imsystem/apps/api/internal/stockcheck"

	"github.com/google/uuid"
)

var ErrReceiveNoteRequired = errors.New("receive note required")

// lockRequest locks the request row and checks its status. Always taken
// before any stock row lock so lock order is request -> stocks(item_id).
func lockRequest(ctx context.Context, tx *sql.Tx, id uuid.UUID, want string) error {
	var status string
	err := tx.QueryRowContext(ctx,
		`SELECT status::text FROM stock_requests WHERE id = $1 FOR UPDATE`, id).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lock request: %w", err)
	}
	if status != want {
		return ErrConflict
	}
	return nil
}

func lineItemIDs(lines []StockRequestLine) []uuid.UUID {
	ids := make([]uuid.UUID, len(lines))
	for i, l := range lines {
		ids[i] = l.ItemID
	}
	return ids
}

// ApproveRequest approves a submitted request after checking warehouse stock
// minus quantities already reserved by OTHER approved requests.
func (r *Repository) ApproveRequest(ctx context.Context, req StockRequest, actor uuid.UUID, allowShortage bool) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if err := lockRequest(ctx, tx, req.ID, StatusSubmitted); err != nil {
		return err
	}
	if err := stockcheck.Lock(ctx, tx, stockcheck.Warehouse, lineItemIDs(req.Lines)); err != nil {
		return err
	}
	needs := make([]stockcheck.Need, len(req.Lines))
	for i, l := range req.Lines {
		needs[i] = stockcheck.Need{ItemID: l.ItemID, Qty: stockcheck.FormatQty(l.Qty)}
	}
	checked, err := stockcheck.Compare(ctx, tx, stockcheck.Warehouse, needs, &req.ID)
	if err != nil {
		return err
	}
	short := stockcheck.Shortages(checked)
	if len(short) > 0 && !allowShortage {
		return &stockcheck.ShortageError{Lines: short}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE stock_requests
		SET status = 'approved', approved_by = $2, approved_at = now()
		WHERE id = $1 AND status = 'submitted'
	`, req.ID, actor); err != nil {
		return fmt.Errorf("approve: %w", err)
	}
	if len(short) > 0 {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, detail)
			VALUES ($1, 'stock_request.approve_with_shortage', 'stock_request', $2, $3)
		`, actor, req.ID, fmt.Sprintf("items_short=%d", len(short))); err != nil {
			return fmt.Errorf("activity approve: %w", err)
		}
	}
	return tx.Commit()
}

// TransferStock ships each line (fully by default, or the qty given in
// overrides), decreases warehouse stock and writes history.
func (r *Repository) TransferStock(ctx context.Context, req StockRequest, actor uuid.UUID, overrides []TransferLineInput, allowShortage bool) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if err := lockRequest(ctx, tx, req.ID, StatusApproved); err != nil {
		return err
	}

	// Desired qty per line: override or full requested qty.
	byLine := make(map[uuid.UUID]StockRequestLine, len(req.Lines))
	for _, l := range req.Lines {
		byLine[l.ID] = l
	}
	desired := make(map[uuid.UUID]string, len(req.Lines))
	for _, l := range req.Lines {
		desired[l.ID] = stockcheck.FormatQty(l.Qty)
	}
	for _, o := range overrides {
		if _, ok := byLine[o.LineID]; !ok {
			return ErrInvalidInput
		}
		q := strings.TrimSpace(o.Qty.String())
		if q == "" {
			return ErrInvalidInput
		}
		desired[o.LineID] = q
	}

	// Validate 0 <= desired <= requested, in NUMERIC.
	lineIDs := make([]string, 0, len(desired))
	qtys := make([]string, 0, len(desired))
	for id, q := range desired {
		lineIDs = append(lineIDs, id.String())
		qtys = append(qtys, q)
	}
	var bad int
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM unnest($1::uuid[], $2::numeric[]) AS t(line_id, qty)
		JOIN stock_request_lines l ON l.id = t.line_id
		WHERE t.qty < 0 OR t.qty > l.qty
	`, lineIDs, qtys).Scan(&bad); err != nil {
		return ErrInvalidInput // non-numeric input lands here
	}
	if bad > 0 {
		return ErrInvalidInput
	}

	if err := stockcheck.Lock(ctx, tx, stockcheck.Warehouse, lineItemIDs(req.Lines)); err != nil {
		return err
	}
	needs := make([]stockcheck.Need, 0, len(req.Lines))
	itemToLine := make(map[uuid.UUID]uuid.UUID, len(req.Lines))
	for _, l := range req.Lines {
		needs = append(needs, stockcheck.Need{ItemID: l.ItemID, Qty: desired[l.ID]})
		itemToLine[l.ItemID] = l.ID
	}
	checked, err := stockcheck.Compare(ctx, tx, stockcheck.Warehouse, needs, nil)
	if err != nil {
		return err
	}
	short := stockcheck.Shortages(checked)
	// Explicit overrides above available stock are always rejected; the
	// allow_shortage shortcut only applies to "ship what is available".
	if len(short) > 0 && (!allowShortage || len(overrides) > 0) {
		return &stockcheck.ShortageError{Lines: short}
	}

	shipped := 0
	partial := false
	for _, chk := range checked {
		lineID := itemToLine[chk.ItemID]
		qty := string(chk.Bisa)
		var positive, full bool
		if err := tx.QueryRowContext(ctx, `
			UPDATE stock_request_lines
			SET qty_transferred = $2::numeric
			WHERE id = $1
			RETURNING qty_transferred > 0, qty_transferred = qty
		`, lineID, qty).Scan(&positive, &full); err != nil {
			return fmt.Errorf("set qty_transferred: %w", err)
		}
		if !full {
			partial = true
		}
		if !positive {
			continue
		}
		shipped++
		var qtyAfter string
		err := tx.QueryRowContext(ctx, `
			UPDATE warehouse_stocks
			SET qty = qty - $2::numeric, updated_at = now()
			WHERE item_id = $1 AND qty >= $2::numeric
			RETURNING qty::text
		`, chk.ItemID, qty).Scan(&qtyAfter)
		if errors.Is(err, sql.ErrNoRows) {
			return &stockcheck.ShortageError{Lines: []stockcheck.Line{chk}}
		}
		if err != nil {
			return fmt.Errorf("decrease warehouse: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO stock_history (
				item_id, location, delta, qty_after, reason, ref_type, ref_id, created_by
			) VALUES ($1, 'warehouse', -($2::numeric), $3::numeric, 'transfer_out', 'stock_request', $4, $5)
		`, chk.ItemID, qty, qtyAfter, req.ID, actor); err != nil {
			return fmt.Errorf("history transfer: %w", err)
		}
	}
	if shipped == 0 {
		return ErrNothingToTransfer
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE stock_requests
		SET status = 'transferred', transferred_by = $2, transferred_at = now()
		WHERE id = $1 AND status = 'approved'
	`, req.ID, actor); err != nil {
		return fmt.Errorf("mark transferred: %w", err)
	}
	if partial {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, detail)
			VALUES ($1, 'stock_request.transfer_partial', 'stock_request', $2, $3)
		`, actor, req.ID, fmt.Sprintf("lines_shipped=%d of %d", shipped, len(req.Lines))); err != nil {
			return fmt.Errorf("activity transfer: %w", err)
		}
	}
	return tx.Commit()
}

var ErrNothingToTransfer = errors.New("nothing to transfer")

// ReceiveStock records what the kitchen actually received (default: what was
// shipped), increases kitchen stock by that amount, and logs any discrepancy.
func (r *Repository) ReceiveStock(ctx context.Context, req StockRequest, actor uuid.UUID, inputs []ReceiveLineInput) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if err := lockRequest(ctx, tx, req.ID, StatusTransferred); err != nil {
		return err
	}

	known := make(map[uuid.UUID]bool, len(req.Lines))
	for _, l := range req.Lines {
		known[l.ID] = true
	}
	inIDs := make([]string, 0, len(inputs))
	inQty := make([]string, 0, len(inputs))
	inNote := make([]string, 0, len(inputs))
	seen := map[uuid.UUID]bool{}
	for _, in := range inputs {
		if !known[in.LineID] || seen[in.LineID] {
			return ErrInvalidInput
		}
		seen[in.LineID] = true
		note := ""
		if in.Note != nil {
			note = strings.TrimSpace(*in.Note)
		}
		inIDs = append(inIDs, in.LineID.String())
		inQty = append(inQty, strings.TrimSpace(in.QtyReceived.String()))
		inNote = append(inNote, note)
	}

	// Resolve and validate every line in NUMERIC.
	rows, err := tx.QueryContext(ctx, `
		WITH inp AS (
			SELECT t.line_id, NULLIF(t.qty, '')::numeric AS qty, NULLIF(t.note, '') AS note
			FROM unnest($2::uuid[], $3::text[], $4::text[]) AS t(line_id, qty, note)
		), res AS (
			SELECT l.id, l.item_id, l.item_name,
			       COALESCE(l.qty_transferred, 0) AS sent,
			       COALESCE(inp.qty, l.qty_transferred, 0) AS got,
			       inp.note
			FROM stock_request_lines l
			LEFT JOIN inp ON inp.line_id = l.id
			WHERE l.request_id = $1
		)
		SELECT id, item_id, item_name, sent::text, got::text, note,
		       got < 0 OR got > sent AS bad,
		       got <> sent AS diff
		FROM res
		ORDER BY item_id
	`, req.ID, inIDs, inQty, inNote)
	if err != nil {
		return ErrInvalidInput // non-numeric qty
	}
	type resolved struct {
		lineID, itemID  uuid.UUID
		name, sent, got string
		note            *string
		bad, diff       bool
	}
	var res []resolved
	for rows.Next() {
		var x resolved
		if err := rows.Scan(&x.lineID, &x.itemID, &x.name, &x.sent, &x.got, &x.note, &x.bad, &x.diff); err != nil {
			rows.Close()
			return fmt.Errorf("scan receive: %w", err)
		}
		res = append(res, x)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return ErrInvalidInput
	}

	var discrepancies []string
	for _, x := range res {
		if x.bad {
			return ErrInvalidInput
		}
		if x.diff {
			if x.note == nil {
				return ErrReceiveNoteRequired
			}
			discrepancies = append(discrepancies, fmt.Sprintf("%s: dikirim %s, diterima %s (%s)", x.name, x.sent, x.got, *x.note))
		}
	}

	if err := stockcheck.Lock(ctx, tx, stockcheck.Kitchen, lineItemIDs(req.Lines)); err != nil {
		return err
	}

	for _, x := range res {
		if _, err := tx.ExecContext(ctx, `
			UPDATE stock_request_lines SET qty_received = $2::numeric, receive_note = $3 WHERE id = $1
		`, x.lineID, x.got, x.note); err != nil {
			return fmt.Errorf("set qty_received: %w", err)
		}
		var positive bool
		var qtyAfter string
		err := tx.QueryRowContext(ctx, `
			INSERT INTO kitchen_stocks (item_id, qty, updated_at)
			VALUES ($1, $2::numeric, now())
			ON CONFLICT (item_id) DO UPDATE
			SET qty = kitchen_stocks.qty + EXCLUDED.qty, updated_at = now()
			RETURNING qty::text, $2::numeric > 0
		`, x.itemID, x.got).Scan(&qtyAfter, &positive)
		if err != nil {
			return fmt.Errorf("increase kitchen: %w", err)
		}
		if !positive {
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO stock_history (
				item_id, location, delta, qty_after, reason, ref_type, ref_id, created_by
			) VALUES ($1, 'kitchen', $2::numeric, $3::numeric, 'transfer_in', 'stock_request', $4, $5)
		`, x.itemID, x.got, qtyAfter, req.ID, actor); err != nil {
			return fmt.Errorf("history receive: %w", err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE stock_requests
		SET status = 'received', received_by = $2, received_at = now()
		WHERE id = $1 AND status = 'transferred'
	`, req.ID, actor); err != nil {
		return fmt.Errorf("mark received: %w", err)
	}
	if len(discrepancies) > 0 {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, detail)
			VALUES ($1, 'stock_request.receive_discrepancy', 'stock_request', $2, $3)
		`, actor, req.ID, strings.Join(discrepancies, "; ")); err != nil {
			return fmt.Errorf("activity receive: %w", err)
		}
	}
	return tx.Commit()
}
