package auth

import (
	"time"

	"github.com/google/uuid"
)

const (
	RoleSuperAdmin   = "super_admin"
	RoleAdminGudang  = "admin_gudang"
	RoleAdminKitchen = "admin_kitchen"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	FullName     string    `json:"full_name"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type UserPublic struct {
	ID       uuid.UUID `json:"id"`
	Email    string    `json:"email"`
	FullName string    `json:"full_name"`
	Role     string    `json:"role"`
	IsActive bool      `json:"is_active"`
}

type CreateUserRequest struct {
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type PatchUserRequest struct {
	FullName *string `json:"full_name"`
	Role     *string `json:"role"`
	IsActive *bool   `json:"is_active"`
}

type ResetPasswordRequest struct {
	Password string `json:"password"`
}

func (u User) Public() UserPublic {
	return UserPublic{
		ID:       u.ID,
		Email:    u.Email,
		FullName: u.FullName,
		Role:     u.Role,
		IsActive: u.IsActive,
	}
}
