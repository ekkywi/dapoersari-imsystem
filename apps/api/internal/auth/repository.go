package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("user not found")

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (User, error) {
	const q = `
		SELECT id, email, full_name, password_hash, role::text, is_active, created_at, updated_at
		FROM users
		WHERE email = $1
		LIMIT 1
	`

	var u User
	err := r.db.QueryRowContext(ctx, q, strings.ToLower(strings.TrimSpace(email))).Scan(
		&u.ID,
		&u.Email,
		&u.FullName,
		&u.PasswordHash,
		&u.Role,
		&u.IsActive,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user by email: %w", err)
	}
	return u, nil
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (User, error) {
	const q = `
		SELECT id, email, full_name, password_hash, role::text, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
		LIMIT 1
	`

	var u User
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&u.ID,
		&u.Email,
		&u.FullName,
		&u.PasswordHash,
		&u.Role,
		&u.IsActive,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user by id: %w", err)
	}
	return u, nil
}
