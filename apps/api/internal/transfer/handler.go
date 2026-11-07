package transfer

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
	"dapoersari-imsystem/apps/api/internal/stockcheck"

	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.List(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat permintaan")
		return
	}
	if out == nil {
		out = []StockRequest{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("requestID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	req, err := h.svc.Get(r.Context(), id)
	if mapTransferErr(w, err, "gagal memuat permintaan") {
		return
	}
	respond.JSON(w, http.StatusOK, req)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	var body CreateStockRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	req, err := h.svc.Create(r.Context(), userID, body)
	if mapTransferErr(w, err, "gagal membuat permintaan") {
		return
	}
	respond.JSON(w, http.StatusCreated, req)
}

func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	id, err := uuid.Parse(r.PathValue("requestID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	var body ApproveRequestRequest
	if err := decodeOptional(r, &body); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	req, err := h.svc.Approve(r.Context(), id, userID, body)
	if mapTransferErr(w, err, "gagal menyetujui permintaan") {
		return
	}
	respond.JSON(w, http.StatusOK, req)
}

func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	id, err := uuid.Parse(r.PathValue("requestID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	var body RejectRequestRequest
	_ = json.NewDecoder(r.Body).Decode(&body)
	req, err := h.svc.Reject(r.Context(), id, userID, body.Reason)
	if mapTransferErr(w, err, "gagal menolak permintaan") {
		return
	}
	respond.JSON(w, http.StatusOK, req)
}

func (h *Handler) Transfer(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	id, err := uuid.Parse(r.PathValue("requestID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	var body TransferRequestRequest
	if err := decodeOptional(r, &body); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	req, err := h.svc.Transfer(r.Context(), id, userID, body)
	if mapTransferErr(w, err, "gagal mentransfer persediaan") {
		return
	}
	respond.JSON(w, http.StatusOK, req)
}

func (h *Handler) Receive(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	id, err := uuid.Parse(r.PathValue("requestID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	var body ReceiveRequestRequest
	if err := decodeOptional(r, &body); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	req, err := h.svc.Receive(r.Context(), id, userID, body)
	if mapTransferErr(w, err, "gagal menerima persediaan") {
		return
	}
	respond.JSON(w, http.StatusOK, req)
}

func (h *Handler) Cancel(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}
	id, err := uuid.Parse(r.PathValue("requestID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	var body CancelRequestRequest
	if err := decodeOptional(r, &body); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	req, err := h.svc.Cancel(r.Context(), id, userID, body.Reason)
	if mapTransferErr(w, err, "gagal membatalkan permintaan") {
		return
	}
	respond.JSON(w, http.StatusOK, req)
}

// decodeOptional decodes a JSON body if present; an empty body is fine.
func decodeOptional(r *http.Request, dst any) error {
	err := json.NewDecoder(r.Body).Decode(dst)
	if errors.Is(err, io.EOF) {
		return nil
	}
	return err
}

func mapTransferErr(w http.ResponseWriter, err error, fallback string) bool {
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
	if errors.Is(err, ErrConflict) {
		respond.Error(w, http.StatusConflict, "status permintaan tidak sesuai")
		return true
	}
	var short *stockcheck.ShortageError
	if errors.As(err, &short) {
		respond.ErrorWithDetails(w, http.StatusConflict,
			"persediaan gudang tidak mencukupi untuk beberapa item", "insufficient_stock", short.Lines)
		return true
	}
	if errors.Is(err, ErrReasonRequired) {
		respond.Error(w, http.StatusBadRequest, "alasan wajib diisi")
		return true
	}
	if errors.Is(err, ErrReceiveNoteRequired) {
		respond.Error(w, http.StatusBadRequest, "catatan wajib diisi untuk baris yang jumlah terimanya berbeda dari yang dikirim")
		return true
	}
	if errors.Is(err, ErrNothingToTransfer) {
		respond.Error(w, http.StatusBadRequest, "minimal satu baris harus dikirim dengan jumlah lebih dari 0")
		return true
	}
	respond.Error(w, http.StatusInternalServerError, fallback)
	return true
}
