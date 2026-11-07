package transfer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

var (
	ErrNotFound          = errors.New("not found")
	ErrInsufficientStock = errors.New("insufficient stock")
	ErrConflict          = errors.New("conflict")
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type NewRequestInput struct {
	Note      *string
	CreatedBy uuid.UUID
	Packages  []StockRequestPackage
	Lines     []StockRequestLine
}

func (r *Repository) CreateRequest(ctx context.Context, in NewRequestInput) (StockRequest, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return StockRequest{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	const qReq = `
		INSERT INTO stock_requests (status, note, created_by)
		VALUES ('submitted', $1, $2)
		RETURNING id, status::text, note, created_by, created_at,
		          approved_by, approved_at, transferred_by, transferred_at,
		          received_by, received_at, rejected_by, rejected_at, reject_reason,
		          cancelled_by, cancelled_at, cancel_reason
	`
	var req StockRequest
	if err := tx.QueryRowContext(ctx, qReq, in.Note, in.CreatedBy).Scan(
		&req.ID, &req.Status, &req.Note, &req.CreatedBy, &req.CreatedAt,
		&req.ApprovedBy, &req.ApprovedAt, &req.TransferredBy, &req.TransferredAt,
		&req.ReceivedBy, &req.ReceivedAt, &req.RejectedBy, &req.RejectedAt, &req.RejectReason,
		&req.CancelledBy, &req.CancelledAt, &req.CancelReason,
	); err != nil {
		return StockRequest{}, fmt.Errorf("insert request: %w", err)
	}

	const qPkg = `
		INSERT INTO stock_request_packages (request_id, menu_id, menu_name, qty_paket)
		VALUES ($1, $2, $3, $4)
	`
	for _, p := range in.Packages {
		if _, err := tx.ExecContext(ctx, qPkg, req.ID, p.MenuID, p.MenuName, p.QtyPaket); err != nil {
			return StockRequest{}, fmt.Errorf("insert package: %w", err)
		}
	}

	const qLine = `
		INSERT INTO stock_request_lines (request_id, item_id, item_sku, item_name, unit_code, qty)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	for _, l := range in.Lines {
		if _, err := tx.ExecContext(ctx, qLine, req.ID, l.ItemID, l.ItemSKU, l.ItemName, l.UnitCode, l.Qty); err != nil {
			return StockRequest{}, fmt.Errorf("insert line: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return StockRequest{}, fmt.Errorf("commit request: %w", err)
	}
	return r.GetRequest(ctx, req.ID)
}

func (r *Repository) ListRequests(ctx context.Context) ([]StockRequest, error) {
	const q = `
		SELECT id, status::text, note, created_by, created_at,
		       approved_by, approved_at, transferred_by, transferred_at,
		       received_by, received_at, rejected_by, rejected_at, reject_reason,
		       cancelled_by, cancelled_at, cancel_reason
		FROM stock_requests
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list requests: %w", err)
	}
	defer rows.Close()

	var out []StockRequest
	for rows.Next() {
		var req StockRequest
		if err := rows.Scan(
			&req.ID, &req.Status, &req.Note, &req.CreatedBy, &req.CreatedAt,
			&req.ApprovedBy, &req.ApprovedAt, &req.TransferredBy, &req.TransferredAt,
			&req.ReceivedBy, &req.ReceivedAt, &req.RejectedBy, &req.RejectedAt, &req.RejectReason,
			&req.CancelledBy, &req.CancelledAt, &req.CancelReason,
		); err != nil {
			return nil, fmt.Errorf("scan request: %w", err)
		}
		out = append(out, req)
	}
	return out, rows.Err()
}

func (r *Repository) GetRequest(ctx context.Context, id uuid.UUID) (StockRequest, error) {
	const q = `
		SELECT id, status::text, note, created_by, created_at,
		       approved_by, approved_at, transferred_by, transferred_at,
		       received_by, received_at, rejected_by, rejected_at, reject_reason,
		       cancelled_by, cancelled_at, cancel_reason
		FROM stock_requests
		WHERE id = $1
		LIMIT 1
	`
	var req StockRequest
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&req.ID, &req.Status, &req.Note, &req.CreatedBy, &req.CreatedAt,
		&req.ApprovedBy, &req.ApprovedAt, &req.TransferredBy, &req.TransferredAt,
		&req.ReceivedBy, &req.ReceivedAt, &req.RejectedBy, &req.RejectedAt, &req.RejectReason,
		&req.CancelledBy, &req.CancelledAt, &req.CancelReason,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return StockRequest{}, ErrNotFound
	}
	if err != nil {
		return StockRequest{}, fmt.Errorf("get request: %w", err)
	}

	pkgs, err := r.listPackages(ctx, id)
	if err != nil {
		return StockRequest{}, err
	}
	lines, err := r.listLines(ctx, id)
	if err != nil {
		return StockRequest{}, err
	}
	req.Packages = pkgs
	req.Lines = lines
	return req, nil
}

func (r *Repository) listPackages(ctx context.Context, requestID uuid.UUID) ([]StockRequestPackage, error) {
	const q = `
		SELECT id, request_id, menu_id, menu_name, qty_paket
		FROM stock_request_packages
		WHERE request_id = $1
		ORDER BY menu_name
	`
	rows, err := r.db.QueryContext(ctx, q, requestID)
	if err != nil {
		return nil, fmt.Errorf("list packages: %w", err)
	}
	defer rows.Close()

	var out []StockRequestPackage
	for rows.Next() {
		var p StockRequestPackage
		if err := rows.Scan(&p.ID, &p.RequestID, &p.MenuID, &p.MenuName, &p.QtyPaket); err != nil {
			return nil, fmt.Errorf("scan package: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) listLines(ctx context.Context, requestID uuid.UUID) ([]StockRequestLine, error) {
	const q = `
		SELECT l.id, l.request_id, l.item_id, l.item_sku, l.item_name, l.unit_code, c.name, l.qty,
		       l.qty_transferred, l.qty_received, l.receive_note
		FROM stock_request_lines l
		LEFT JOIN items i ON i.id = l.item_id
		LEFT JOIN categories c ON c.id = i.category_id
		WHERE l.request_id = $1
		ORDER BY l.item_name
	`
	rows, err := r.db.QueryContext(ctx, q, requestID)
	if err != nil {
		return nil, fmt.Errorf("list lines: %w", err)
	}
	defer rows.Close()

	var out []StockRequestLine
	for rows.Next() {
		var l StockRequestLine
		if err := rows.Scan(
			&l.ID, &l.RequestID, &l.ItemID, &l.ItemSKU, &l.ItemName, &l.UnitCode, &l.CategoryName, &l.Qty,
			&l.QtyTransferred, &l.QtyReceived, &l.ReceiveNote,
		); err != nil {
			return nil, fmt.Errorf("scan line: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// UpdateStatus is a compare-and-set: it only changes rows whose current status
// is one of fromStatuses. reason is used for rejected/cancelled.
func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, fromStatuses []string, toStatus string, actor uuid.UUID, reason *string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var q string
	var args []any
	switch toStatus {
	case StatusApproved:
		q = `
			UPDATE stock_requests
			SET status = 'approved', approved_by = $2, approved_at = now()
			WHERE id = $1 AND status::text = ANY($3::text[])
		`
		args = []any{id, actor, fromStatuses}
	case StatusRejected:
		q = `
			UPDATE stock_requests
			SET status = 'rejected', rejected_by = $2, rejected_at = now(), reject_reason = $3
			WHERE id = $1 AND status::text = ANY($4::text[])
		`
		args = []any{id, actor, reason, fromStatuses}
	case StatusCancelled:
		q = `
			UPDATE stock_requests
			SET status = 'cancelled', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3
			WHERE id = $1 AND status::text = ANY($4::text[])
		`
		args = []any{id, actor, reason, fromStatuses}
	case StatusTransferred:
		q = `
			UPDATE stock_requests
			SET status = 'transferred', transferred_by = $2, transferred_at = now()
			WHERE id = $1 AND status::text = ANY($3::text[])
		`
		args = []any{id, actor, fromStatuses}
	case StatusReceived:
		q = `
			UPDATE stock_requests
			SET status = 'received', received_by = $2, received_at = now()
			WHERE id = $1 AND status::text = ANY($3::text[])
		`
		args = []any{id, actor, fromStatuses}
	default:
		return fmt.Errorf("unsupported status")
	}

	res, err := tx.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("update status: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrConflict
	}
	return tx.Commit()
}
