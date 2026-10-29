package warehouse

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

var ErrInvalidInput = errors.New("invalid input")

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListUnits(ctx context.Context) ([]Unit, error) {
	return s.repo.ListUnits(ctx)
}

func (s *Service) CreateUnit(ctx context.Context, req CreateUnitRequest) (Unit, error) {
	code := strings.TrimSpace(req.Code)
	name := strings.TrimSpace(req.Name)
	if code == "" || name == "" {
		return Unit{}, ErrInvalidInput
	}
	return s.repo.CreateUnit(ctx, code, name)
}

func (s *Service) CreateItem(ctx context.Context, req CreateItemRequest) (Item, error) {
	sku := strings.TrimSpace(req.SKU)
	name := strings.TrimSpace(req.Name)
	if sku == "" || name == "" || req.UnitID == uuid.Nil || req.MinStock < 0 {
		return Item{}, ErrInvalidInput
	}
	return s.repo.CreateItem(ctx, Item{
		SKU:        sku,
		Name:       name,
		CategoryID: req.CategoryID,
		UnitID:     req.UnitID,
		MinStock:   req.MinStock,
	})
}

func (s *Service) ListItems(ctx context.Context) ([]Item, error) {
	return s.repo.ListItems(ctx)
}

func (s *Service) GetWarehouseStock(ctx context.Context, itemID uuid.UUID) (WarehouseStock, error) {
	if itemID == uuid.Nil {
		return WarehouseStock{}, ErrInvalidInput
	}
	return s.repo.GetWarehouseStock(ctx, itemID)
}

func (s *Service) ListWarehouseStocks(ctx context.Context) ([]WarehouseStock, error) {
	return s.repo.ListWarehouseStocks(ctx)
}

func (s *Service) ListCategories(ctx context.Context) ([]Category, error) {
	return s.repo.ListCategories(ctx)
}

func (s *Service) CreateCategory(ctx context.Context, req CreateCategoryRequest) (Category, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return Category{}, ErrInvalidInput
	}
	return s.repo.CreateCategory(ctx, name)
}

func (s *Service) ListSuppliers(ctx context.Context) ([]Supplier, error) {
	return s.repo.ListSuppliers(ctx)
}

func (s *Service) CreateSupplier(ctx context.Context, req CreateSupplierRequest) (Supplier, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return Supplier{}, ErrInvalidInput
	}
	return s.repo.CreateSupplier(ctx, name, req.Phone, req.Note)
}

func (s *Service) CreateStockIn(ctx context.Context, createdBy uuid.UUID, req CreateStockInRequest) (StockInResult, error) {
	if createdBy == uuid.Nil || req.ItemID == uuid.Nil || req.Qty <= 0 {
		return StockInResult{}, ErrInvalidInput
	}

	item, err := s.repo.FindItemByID(ctx, req.ItemID)
	if err != nil {
		return StockInResult{}, err
	}
	if !item.IsActive {
		return StockInResult{}, ErrInvalidInput
	}

	if req.SupplierID != nil {
		if *req.SupplierID == uuid.Nil {
			return StockInResult{}, ErrInvalidInput
		}
		if _, err := s.repo.FindSupplierByID(ctx, *req.SupplierID); err != nil {
			return StockInResult{}, err
		}
	}

	var note *string
	if req.Note != nil {
		trimmed := strings.TrimSpace(*req.Note)
		if trimmed != "" {
			note = &trimmed
		}
	}

	return s.repo.CreateStockIn(ctx, StockIn{
		ItemID:     req.ItemID,
		SupplierID: req.SupplierID,
		Qty:        req.Qty,
		Note:       note,
		ExpiredAt:  req.ExpiredAt,
		CreatedBy:  createdBy,
	})
}

func (s *Service) ListStockIns(ctx context.Context) ([]StockIn, error) {
	return s.repo.ListStockIns(ctx)
}
