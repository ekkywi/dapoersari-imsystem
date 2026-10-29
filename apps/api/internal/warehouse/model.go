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

// Request bodies (for handler later)

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
