package warehouse

import (
	"time"

	"github.com/google/uuid"
)

type Unit struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Category struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Supplier struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Phone     *string   `json:"phone,omitempty"`
	Note      *string   `json:"note,omitempty"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Item struct {
	ID         uuid.UUID  `json:"id"`
	SKU        string     `json:"sku"`
	Name       string     `json:"name"`
	CategoryID *uuid.UUID `json:"category_id,omitempty"`
	UnitID     uuid.UUID  `json:"unit_id"`
	MinStock   float64    `json:"min_stock"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
}

type WarehouseStock struct {
	ItemID    uuid.UUID `json:"item_id"`
	Qty       float64   `json:"qty"`
	UpdatedAt time.Time `json:"updated_at"`
}

type StockIn struct {
	ID         uuid.UUID  `json:"id"`
	ItemID     uuid.UUID  `json:"item_id"`
	SupplierID *uuid.UUID `json:"supplier_id,omitempty"`
	Qty        float64    `json:"qty"`
	Note       *string    `json:"note,omitempty"`
	ExpiredAt  *time.Time `json:"expired_at,omitempty"`
	CreatedBy  uuid.UUID  `json:"created_by"`
	CreatedAt  time.Time  `json:"created_at"`
}

type StockInResult struct {
	StockIn StockIn        `json:"stock_in"`
	Stock   WarehouseStock `json:"stock"`
}

// StockInDetail is stock-in plus catalog labels for document/print views.
type StockInDetail struct {
	StockIn
	ItemSKU      string  `json:"item_sku"`
	ItemName     string  `json:"item_name"`
	UnitCode     string  `json:"unit_code"`
	CategoryName *string `json:"category_name,omitempty"`
	SupplierName *string `json:"supplier_name,omitempty"`
}

// Request bodies

type CreateUnitRequest struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type CreateCategoryRequest struct {
	Name string `json:"name"`
}

type CreateSupplierRequest struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
	Note  *string `json:"note"`
}

type CreateItemRequest struct {
	SKU        string     `json:"sku"`
	Name       string     `json:"name"`
	CategoryID *uuid.UUID `json:"category_id"`
	UnitID     uuid.UUID  `json:"unit_id"`
	MinStock   float64    `json:"min_stock"`
}

type CreateStockInRequest struct {
	ItemID     uuid.UUID  `json:"item_id"`
	SupplierID *uuid.UUID `json:"supplier_id"`
	Qty        float64    `json:"qty"`
	Note       *string    `json:"note"`
	ExpiredAt  *time.Time `json:"expired_at"`
}
