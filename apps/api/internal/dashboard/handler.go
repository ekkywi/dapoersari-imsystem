package dashboard

import (
	"errors"
	"net/http"

	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.Summary(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat ringkasan")
		return
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) LowStock(w http.ResponseWriter, r *http.Request) {
	loc := r.URL.Query().Get("location")
	out, err := h.svc.LowStock(r.Context(), loc)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat alert")
		return
	}
	if out == nil {
		out = []LowStockAlert{}
	}
	respond.JSON(w, http.StatusOK, out)
}
