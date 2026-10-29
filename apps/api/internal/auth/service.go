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
	ErrInactiveUser = errors.New("user is inactive")
)

type Service struct {
	repo      *Repository
	jwtSecret []byte
	tokenTTL  time.Duration
}

func NewService(repo *Repository, jwtSecret string) *Service {
	return &Service{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
		tokenTTL:  24 * time.Hour,
	}
}

type Claims struct {
	Role string `json:"role"`
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
		User: user,
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
		Role: user.Role,
		Email: user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: user.ID.String(),
			IssuedAt: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.tokenTTL)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(s.jwtSecret)
}