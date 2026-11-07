package kitchen

import (
	"time"

	"github.com/google/uuid"
)

type Menu struct {
	ID        uuid.UUID    `json:"id"`
	Name      string       `json:"name"`
	IsActive  bool         `json:"is_active"`
	CreatedAt time.Time    `json:"created_at"`
	Lines     []RecipeLine `json:"lines,omitempty"`
}

type RecipeLine struct {
	ID          uuid.UUID `json:"id"`
	MenuID      uuid.UUID `json:"menu_id"`
	ItemID      uuid.UUID `json:"item_id"`
	QtyPerPaket float64   `json:"qty_per_paket"`
	ItemSKU     string    `json:"item_sku,omitempty"`
	ItemName    string    `json:"item_name,omitempty"`
	UnitCode    string    `json:"unit_code,omitempty"`
}

type KitchenStock struct {
	ItemID    uuid.UUID `json:"item_id"`
	Qty       float64   `json:"qty"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateMenuRequest struct {
	Name  string            `json:"name"`
	Lines []RecipeLineInput `json:"lines"`
}

type RecipeLineInput struct {
	ItemID      uuid.UUID `json:"item_id"`
	QtyPerPaket float64   `json:"qty_per_paket"`
}

type ReplaceRecipeRequest struct {
	Lines []RecipeLineInput `json:"lines"`
}

type PatchMenuRequest struct {
	Name     *string `json:"name"`
	IsActive *bool   `json:"is_active"`
}

type MenuClosing struct {
	ID           uuid.UUID            `json:"id"`
	ClosingDate  string               `json:"closing_date"`
	Note         *string              `json:"note,omitempty"`
	ShortageNote *string              `json:"shortage_note,omitempty"`
	HasShortage  bool                 `json:"has_shortage"`
	CreatedBy    uuid.UUID            `json:"created_by"`
	CreatedAt    time.Time            `json:"created_at"`
	Packages     []MenuClosingPackage `json:"packages,omitempty"`
	Lines        []MenuClosingLine    `json:"lines,omitempty"`
}

type MenuClosingPackage struct {
	ID        uuid.UUID  `json:"id"`
	ClosingID uuid.UUID  `json:"closing_id"`
	MenuID    *uuid.UUID `json:"menu_id,omitempty"`
	MenuName  string     `json:"menu_name"`
	QtyPaket  float64    `json:"qty_paket"`
}

type MenuClosingLine struct {
	ID        uuid.UUID `json:"id"`
	ClosingID uuid.UUID `json:"closing_id"`
	ItemID    uuid.UUID `json:"item_id"`
	ItemSKU   string    `json:"item_sku"`
	ItemName  string    `json:"item_name"`
	UnitCode  string    `json:"unit_code"`
	Qty       float64   `json:"qty"`
	// ShortageQty is the part of Qty that could not be deducted (stock was short).
	ShortageQty float64 `json:"shortage_qty"`
}

type CreateClosingRequest struct {
	ClosingDate   string                `json:"closing_date"`
	Note          *string               `json:"note"`
	AllowShortage bool                  `json:"allow_shortage"`
	ShortageNote  *string               `json:"shortage_note"`
	Packages      []ClosingPackageInput `json:"packages"`
}

type ClosingPackageInput struct {
	MenuID   uuid.UUID `json:"menu_id"`
	QtyPaket float64   `json:"qty_paket"`
}
