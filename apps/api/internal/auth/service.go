package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInactiveUser       = errors.New("user is inactive")
	ErrInvalidInput       = errors.New("invalid input")
	ErrEmailTaken         = errors.New("email taken")
	ErrForbiddenAction    = errors.New("forbidden action")
)

type Service struct {
	repo      *Repository
	jwtSecret []byte
	tokenTTL  time.Duration
}

func NewService(repo *Repository, jwtSecret string, tokenTTL time.Duration) *Service {
	if tokenTTL <= 0 {
		tokenTTL = 24 * time.Hour
	}
	return &Service{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
		tokenTTL:  tokenTTL,
	}
}

type Claims struct {
	Role  string `json:"role"`
	Email string `json:"email"`
	jwt.RegisteredClaims
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (LoginResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		return LoginResponse{}, ErrInvalidCredentials
	}

	user, err := s.repo.FindByEmail(ctx, email)
	if errors.Is(err, ErrNotFound) {
		return LoginResponse{}, ErrInvalidCredentials
	}
	if err != nil {
		return LoginResponse{}, err
	}
	if !user.IsActive {
		return LoginResponse{}, ErrInactiveUser
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return LoginResponse{}, ErrInvalidCredentials
	}

	token, err := s.issueToken(user)
	if err != nil {
		return LoginResponse{}, err
	}

	return LoginResponse{
		Token: token,
		User:  user,
	}, nil
}

func (s *Service) Me(ctx context.Context, userID uuid.UUID) (User, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		return User{}, ErrNotFound
	}
	return user, err
}

func (s *Service) ParseToken(tokenStr string) (uuid.UUID, string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return uuid.Nil, "", err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return uuid.Nil, "", fmt.Errorf("invalid token")
	}

	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("invalid subject")
	}
	return id, claims.Role, nil
}

func (s *Service) issueToken(user User) (string, error) {
	now := time.Now()
	claims := Claims{
		Role:  user.Role,
		Email: user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.tokenTTL)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(s.jwtSecret)
}

func validRole(role string) bool {
	switch role {
	case RoleSuperAdmin, RoleAdminGudang, RoleAdminKitchen:
		return true
	default:
		return false
	}
}

func hashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

const minPasswordLen = 8

func (s *Service) ListUsers(ctx context.Context) ([]User, error) {
	return s.repo.List(ctx)
}

func (s *Service) CreateUser(ctx context.Context, req CreateUserRequest) (User, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	fullName := strings.TrimSpace(req.FullName)
	password := req.Password
	role := strings.TrimSpace(req.Role)

	if email == "" || fullName == "" || len(password) < minPasswordLen || !validRole(role) {
		return User{}, ErrInvalidInput
	}

	if _, err := s.repo.FindByEmail(ctx, email); err == nil {
		return User{}, ErrEmailTaken
	} else if !errors.Is(err, ErrNotFound) {
		return User{}, err
	}

	hash, err := hashPassword(password)
	if err != nil {
		return User{}, err
	}
	return s.repo.Create(ctx, email, fullName, hash, role)
}

func (s *Service) PatchUser(ctx context.Context, actorID, targetID uuid.UUID, req PatchUserRequest) (User, error) {
	target, err := s.repo.FindByID(ctx, targetID)
	if errors.Is(err, ErrNotFound) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}

	fullName := target.FullName
	role := target.Role
	isActive := target.IsActive

	if req.FullName != nil {
		fullName = strings.TrimSpace(*req.FullName)
		if fullName == "" {
			return User{}, ErrInvalidInput
		}
	}
	if req.Role != nil {
		role = strings.TrimSpace(*req.Role)
		if !validRole(role) {
			return User{}, ErrInvalidInput
		}
	}
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	if target.IsActive && !isActive && targetID == actorID {
		return User{}, ErrForbiddenAction
	}

	losingSuper := target.Role == RoleSuperAdmin && target.IsActive &&
		(role != RoleSuperAdmin || !isActive)
	if losingSuper {
		n, err := s.repo.CountActiveByRole(ctx, RoleSuperAdmin)
		if err != nil {
			return User{}, err
		}
		if n <= 1 {
			return User{}, ErrForbiddenAction
		}
	}

	return s.repo.Update(ctx, targetID, fullName, role, isActive)
}

func (s *Service) ResetPassword(ctx context.Context, targetID uuid.UUID, password string) error {
	if len(password) < minPasswordLen {
		return ErrInvalidInput
	}
	if _, err := s.repo.FindByID(ctx, targetID); errors.Is(err, ErrNotFound) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	return s.repo.SetPasswordHash(ctx, targetID, hash)
}
