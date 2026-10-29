package kitchen

import (
	"encoding/json"
	"errors"
	"net/http"

	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/httpapi/respond"

	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListMenus(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListMenus(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat menu")
		return
	}
	if out == nil {
		out = []Menu{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) GetMenu(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("menuID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	m, err := h.svc.GetMenu(r.Context(), id)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusNotFound, "data tidak ditemukan")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat menu")
		return
	}
	respond.JSON(w, http.StatusOK, m)
}

func (h *Handler) CreateMenu(w http.ResponseWriter, r *http.Request) {
	var req CreateMenuRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	m, err := h.svc.CreateMenu(r.Context(), req)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusNotFound, "item tidak ditemukan")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal membuat menu")
		return
	}
	respond.JSON(w, http.StatusCreated, m)
}

func (h *Handler) ReplaceRecipe(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("menuID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	var req ReplaceRecipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	m, err := h.svc.ReplaceRecipe(r.Context(), id, req)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusNotFound, "data tidak ditemukan")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memperbarui resep")
		return
	}
	respond.JSON(w, http.StatusOK, m)
}

func (h *Handler) ListKitchenStocks(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListKitchenStocks(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat stok dapur")
		return
	}
	if out == nil {
		out = []KitchenStock{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) ListClosings(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListClosings(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat penutupan")
		return
	}
	if out == nil {
		out = []MenuClosing{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) GetClosing(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("closingID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	c, err := h.svc.GetClosing(r.Context(), id)
	if mapKitchenErr(w, err, "gagal memuat penutupan") {
		return
	}
	respond.JSON(w, http.StatusOK, c)
}

func (h *Handler) CreateClosing(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	var body CreateClosingRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	c, err := h.svc.CreateClosing(r.Context(), userID, body)
	if mapKitchenErr(w, err, "gagal membuat penutupan") {
		return
	}
	respond.JSON(w, http.StatusCreated, c)
}

func mapKitchenErr(w http.ResponseWriter, err error, fallback string) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return true
	}
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusNotFound, "data tidak ditemukan")
		return true
	}
	if errors.Is(err, ErrInsufficientStock) {
		respond.Error(w, http.StatusConflict, "stok dapur tidak mencukupi")
		return true
	}
	respond.Error(w, http.StatusInternalServerError, fallback)
	return true
}
