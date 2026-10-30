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

func (r *Repository) List(ctx context.Context) ([]User, error) {
	const q = `
		SELECT id, email, full_name, password_hash, role::text, is_active, created_at, updated_at
		FROM users
		ORDER BY created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	out := make([]User, 0)
	for rows.Next() {
		var u User
		if err := rows.Scan(
			&u.ID, &u.Email, &u.FullName, &u.PasswordHash,
			&u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list users rows: %w", err)
	}
	return out, nil
}

func (r *Repository) Create(ctx context.Context, email, fullName, passwordHash, role string) (User, error) {
	const q = `
		INSERT INTO users (email, full_name, password_hash, role)
		VALUES ($1, $2, $3, $4::user_role)
		RETURNING id, email, full_name, password_hash, role::text, is_active, created_at, updated_at
	`
	var u User
	err := r.db.QueryRowContext(ctx, q, email, fullName, passwordHash, role).Scan(
		&u.ID, &u.Email, &u.FullName, &u.PasswordHash,
		&u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return User{}, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, fullName, role string, isActive bool) (User, error) {
	const q = `
		UPDATE users
		SET full_name = $2,
			role = $3::user_role,
			is_active = $4,
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, email, full_name, password_hash, role::text, is_active, created_at
	`
	var u User
	err := r.db.QueryRowContext(ctx, q, id, fullName, role, isActive).Scan(
		&u.ID, &u.Email, &u.FullName, &u.PasswordHash,
		&u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("updated user: %w", err)
	}
	return u, nil
}

func (r *Repository) SetPasswordHash(ctx context.Context, id uuid.UUID, passwordHash string) error {
	const q = `
		UPDATE users
		SET password_hash = $2, updated_at = NOW()
		WHERE id = $1
	`
	res, err := r.db.ExecContext(ctx, q, id, passwordHash)
	if err != nil {
		return fmt.Errorf("set password: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("set password rows: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) CountActiveByRole(ctx context.Context, role string) (int, error) {
	const q = `
		SELECT COUNT(*) FROM users
		WHERE role = $1::user_role AND is_active = TRUE
	`
	var n int
	if err := r.db.QueryRowContext(ctx, q, role).Scan(&n); err != nil {
		return 0, fmt.Errorf("count active by role: %w", err)
	}
	return n, nil
}
