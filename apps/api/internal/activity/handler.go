package activity

import (
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

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	out, err := h.svc.List(r.Context(), limit)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat aktivitas")
		return
	}
	if out == nil {
		out = []Entry{}
	}
	respond.JSON(w, http.StatusOK, out)
}
