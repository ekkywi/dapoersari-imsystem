package warehouse

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

func (h *Handler) ListUnits(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListUnits(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat satuan")
		return
	}
	if out == nil {
		out = []Unit{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) CreateUnit(w http.ResponseWriter, r *http.Request) {
	var req CreateUnitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	u, err := h.svc.CreateUnit(r.Context(), req)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal membuat satuan")
		return
	}
	respond.JSON(w, http.StatusCreated, u)
}

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListCategories(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat kategori")
		return
	}
	if out == nil {
		out = []Category{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	c, err := h.svc.CreateCategory(r.Context(), req)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal membuat kategori")
		return
	}
	respond.JSON(w, http.StatusCreated, c)
}

func (h *Handler) ListSuppliers(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListSuppliers(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat pemasok")
		return
	}
	if out == nil {
		out = []Supplier{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) CreateSupplier(w http.ResponseWriter, r *http.Request) {
	var req CreateSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	s, err := h.svc.CreateSupplier(r.Context(), req)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal membuat pemasok")
		return
	}
	respond.JSON(w, http.StatusCreated, s)
}

func (h *Handler) ListItems(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListItems(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat item")
		return
	}
	if out == nil {
		out = []Item{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) CreateItem(w http.ResponseWriter, r *http.Request) {
	var req CreateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}
	it, err := h.svc.CreateItem(r.Context(), req)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal membuat item")
		return
	}
	respond.JSON(w, http.StatusCreated, it)
}

func (h *Handler) ListWarehouseStocks(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListWarehouseStocks(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat stok")
		return
	}
	if out == nil {
		out = []WarehouseStock{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) GetWarehouseStock(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("itemID"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	s, err := h.svc.GetWarehouseStock(r.Context(), id)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusNotFound, "data tidak ditemukan")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat stok")
		return
	}
	respond.JSON(w, http.StatusOK, s)
}

func (h *Handler) ListStockIns(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.ListStockIns(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal memuat stok masuk")
		return
	}
	if out == nil {
		out = []StockIn{}
	}
	respond.JSON(w, http.StatusOK, out)
}

func (h *Handler) CreateStockIn(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "tidak diizinkan")
		return
	}

	var req CreateStockInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "JSON body permintaan tidak valid")
		return
	}

	res, err := h.svc.CreateStockIn(r.Context(), userID, req)
	if errors.Is(err, ErrInvalidInput) {
		respond.Error(w, http.StatusBadRequest, "data tidak valid")
		return
	}
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusNotFound, "data tidak ditemukan")
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gagal mencatat stok masuk")
		return
	}
	respond.JSON(w, http.StatusCreated, res)
}
