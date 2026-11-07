package warehouse

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

var (
	ErrInvalidInput = errors.New("invalid input")
	ErrItemInactive = errors.New("item inactive")
)

// ItemInUseError blocks deactivating an item that is still referenced.
type ItemInUseError struct {
	Usages []ItemUsage
}

func (e *ItemInUseError) Error() string { return "item in use" }

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

func (s *Service) PatchUnit(ctx context.Context, id uuid.UUID, req PatchUnitRequest) (Unit, error) {
	cur, err := s.repo.FindUnitByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return Unit{}, ErrNotFound
	}
	if err != nil {
		return Unit{}, err
	}
	code, name := cur.Code, cur.Name
	if req.Code != nil {
		code = strings.TrimSpace(*req.Code)
	}
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if code == "" || name == "" {
		return Unit{}, ErrInvalidInput
	}
	return s.repo.UpdateUnit(ctx, id, code, name)
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

func (s *Service) PatchItem(ctx context.Context, id uuid.UUID, req PatchItemRequest) (Item, error) {
	cur, err := s.repo.FindItemByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, err
	}
	sku, name, cat, minStock, active := cur.SKU, cur.Name, cur.CategoryID, cur.MinStock, cur.IsActive
	if req.SKU != nil {
		sku = strings.TrimSpace(*req.SKU)
	}
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if req.ClearCategory {
		cat = nil
	} else if req.CategoryID != nil {
		if *req.CategoryID == uuid.Nil {
			cat = nil
		} else {
			cat = req.CategoryID
		}
	}
	if req.MinStock != nil {
		minStock = *req.MinStock
	}
	if req.IsActive != nil {
		active = *req.IsActive
	}
	if sku == "" || name == "" || minStock < 0 {
		return Item{}, ErrInvalidInput
	}
	if cur.IsActive && !active {
		usages, err := s.repo.ItemUsages(ctx, id)
		if err != nil {
			return Item{}, err
		}
		if len(usages) > 0 {
			return Item{}, &ItemInUseError{Usages: usages}
		}
	}
	return s.repo.UpdateItem(ctx, Item{
		ID:         id,
		SKU:        sku,
		Name:       name,
		CategoryID: cat,
		UnitID:     cur.UnitID,
		MinStock:   minStock,
		IsActive:   active,
	})
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

func (s *Service) PatchCategory(ctx context.Context, id uuid.UUID, req PatchCategoryRequest) (Category, error) {
	cur, err := s.repo.FindCategoryByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return Category{}, ErrNotFound
	}
	if err != nil {
		return Category{}, err
	}
	name := cur.Name
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if name == "" {
		return Category{}, ErrInvalidInput
	}
	return s.repo.UpdateCategory(ctx, id, name)
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

func (s *Service) PatchSupplier(ctx context.Context, id uuid.UUID, req PatchSupplierRequest) (Supplier, error) {
	cur, err := s.repo.FindSupplierByID(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return Supplier{}, ErrNotFound
	}
	if err != nil {
		return Supplier{}, err
	}
	name, phone, note, active := cur.Name, cur.Phone, cur.Note, cur.IsActive
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if name == "" {
			return Supplier{}, ErrInvalidInput
		}
	}
	if req.Phone != nil {
		p := strings.TrimSpace(*req.Phone)
		if p == "" {
			phone = nil
		} else {
			phone = &p
		}
	}
	if req.Note != nil {
		n := strings.TrimSpace(*req.Note)
		if n == "" {
			note = nil
		} else {
			note = &n
		}
	}
	if req.IsActive != nil {
		active = *req.IsActive
	}
	return s.repo.UpdateSupplier(ctx, id, name, phone, note, active)
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
		return StockInResult{}, ErrItemInactive
	}

	if req.SupplierID != nil {
		if *req.SupplierID == uuid.Nil {
			return StockInResult{}, ErrInvalidInput
		}
		sup, err := s.repo.FindSupplierByID(ctx, *req.SupplierID)
		if err != nil {
			return StockInResult{}, err
		}
		if !sup.IsActive {
			return StockInResult{}, ErrInvalidInput
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

func (s *Service) GetStockIn(ctx context.Context, id uuid.UUID) (StockInDetail, error) {
	return s.repo.FindStockInByID(ctx, id)
}
