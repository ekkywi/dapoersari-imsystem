package history

import (
	"errors"
	"net/http"
	"strconv"

	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListStock(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	out, err := h.svc.ListStock(r.Context(), q.Get("location"), q.Get("item_id"), limit)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat riwayat persediaan")
		return
	}
	if out == nil {
		out = []StockEntry{}
	}
	respond.JSON(w, http.StatusOK, out)
}
