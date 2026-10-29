package activity

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Entry struct {
	ID         uuid.UUID  `json:"id"`
	ActorID    *uuid.UUID `json:"actor_id,omitempty"`
	Action     string     `json:"action"`
	EntityType *string    `json:"entity_type,omitempty"`
	EntityID   *uuid.UUID `json:"entity_id,omitempty"`
	Detail     *string    `json:"detail,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type LogInput struct {
	ActorID    uuid.UUID
	Action     string
	EntityType string
	EntityID   uuid.UUID
	Detail     string
}

func (r *Repository) Log(ctx context.Context, in LogInput) error {
	return r.LogTx(ctx, r.db, in)
}

type dbTX interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func (r *Repository) LogTx(ctx context.Context, exec dbTX, in LogInput) error {
	const q = `
		INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, detail)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''))
	`
	var detail any
	if in.Detail != "" {
		detail = in.Detail
	}
	_, err := exec.ExecContext(ctx, q, in.ActorID, in.Action, in.EntityType, in.EntityID, detail)
	if err != nil {
		return fmt.Errorf("insert activity: %w", err)
	}
	return nil
}

func (r *Repository) List(ctx context.Context, limit int) ([]Entry, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	const q = `
		SELECT id, actor_id, action, entity_type, entity_id, detail, created_at
		FROM activity_logs
		ORDER BY created_at DESC
		LIMIT $1
	`
	rows, err := r.db.QueryContext(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("list activity: %w", err)
	}
	defer rows.Close()

	var out []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(
			&e.ID, &e.ActorID, &e.Action, &e.EntityType, &e.EntityID, &e.Detail, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan activity: %w", err)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
