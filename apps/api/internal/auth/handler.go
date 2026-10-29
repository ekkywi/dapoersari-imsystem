package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"dapoersari-imsystem/apps/api/internal/httpapi/respond"

	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}

	res, err := h.svc.Login(r.Context(), req)
	if errors.Is(err, ErrInvalidCredentials) {
		respond.Error(w, http.StatusUnauthorized, "email atau kata sandi salah")
		return
	}
	if errors.Is(err, ErrInactiveUser) {
		respond.Error(w, http.StatusForbidden, "akun tidak aktif")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal masuk")
		return
	}

	respond.JSON(w, http.StatusOK, map[string]any{
		"token": res.Token,
		"user":  res.User.Public(),
	})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}

	user, err := h.svc.Me(r.Context(), userID)
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat pengguna")
		return
	}

	respond.JSON(w, http.StatusOK, user.Public())
}

type ctxKey string

const (
	ctxUserID ctxKey = "userID"
	ctxRole   ctxKey = "role"
)

func ContextWithUser(ctx context.Context, userID uuid.UUID, role string) context.Context {
	ctx = context.WithValue(ctx, ctxUserID, userID)
	ctx = context.WithValue(ctx, ctxRole, role)
	return ctx
}

func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(ctxUserID).(uuid.UUID)
	return id, ok
}

func RoleFromContext(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(ctxRole).(string)
	return role, ok
}
