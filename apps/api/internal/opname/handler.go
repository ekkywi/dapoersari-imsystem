package opname

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

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	loc := r.URL.Query().Get("location")
	out, err := h.svc.List(r.Context(), loc)
	if mapOpnameErr(w, err, "gagal memuat opname") {
		return
	}
	if out == nil {
		out = []Opname{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("opnameID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	o, err := h.svc.Get(r.Context(), id)
	if mapOpnameErr(w, err, "gagal memuat opname") {
		return
	}
	respond.JSON(w, http.StatusOK, o)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	role, ok := auth.RoleFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	var body CreateOpnameRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	o, err := h.svc.Create(r.Context(), userID, role, body)
	if mapOpnameErr(w, err, "gagal membuat opname") {
		return
	}
	respond.JSON(w, http.StatusCreated, o)
}

func (h *Handler) Confirm(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	role, ok := auth.RoleFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	id, err := uuid.Parse(r.PathValue("opnameID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	o, err := h.svc.Confirm(r.Context(), id, userID, role)
	if mapOpnameErr(w, err, "gagal mengonfirmasi opname") {
		return
	}
	respond.JSON(w, http.StatusOK, o)
}

func mapOpnameErr(w http.ResponseWriter, err error, fallback string) bool {
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
	if errors.Is(err, ErrClosingMissing) {
		respond.ErrorWithDetails(w, http.StatusConflict,
			"belum ada akhir shift (closing) dapur untuk hari ini; lakukan closing dulu sebelum menghitung, atau konfirmasi tetap lanjut",
			"closing_missing", nil)
		return true
	}
	if errors.Is(err, ErrClosingAfterDraft) {
		respond.ErrorWithDetails(w, http.StatusConflict,
			"ada akhir shift (closing) yang dicatat setelah draf ini dibuat; pemakaiannya akan terhitung dua kali. Buat draf opname baru setelah closing",
			"closing_after_draft", nil)
		return true
	}
	if errors.Is(err, ErrForbidden) {
		respond.Error(w, http.StatusForbidden, "akses ditolak untuk peran ini")
		return true
	}
	if errors.Is(err, ErrConflict) {
		respond.Error(w, http.StatusConflict, "status opname tidak sesuai")
		return true
	}
	respond.Error(w, http.StatusInternalServerError, fallback)
	return true
}
