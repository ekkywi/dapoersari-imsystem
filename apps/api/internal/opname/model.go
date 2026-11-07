package opname

import (
	"time"

	"github.com/google/uuid"
)

const (
	LocationWarehouse = "warehouse"
	LocationKitchen   = "kitchen"

	StatusDraft     = "draft"
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

type Opname struct {
	ID          uuid.UUID    `json:"id"`
	Location    string       `json:"location"`
	Status      string       `json:"status"`
	Note        *string      `json:"note,omitempty"`
	CreatedBy   uuid.UUID    `json:"created_by"`
	CreatedAt   time.Time    `json:"created_at"`
	ConfirmedBy *uuid.UUID   `json:"confirmed_by,omitempty"`
	ConfirmedAt *time.Time   `json:"confirmed_at,omitempty"`
	Lines       []OpnameLine `json:"lines,omitempty"`
}

type OpnameLine struct {
	ID           uuid.UUID `json:"id"`
	OpnameID     uuid.UUID `json:"opname_id"`
	ItemID       uuid.UUID `json:"item_id"`
	ItemSKU      string    `json:"item_sku"`
	ItemName     string    `json:"item_name"`
	UnitCode     string    `json:"unit_code"`
	CategoryName *string   `json:"category_name,omitempty"`
	SystemQty    float64   `json:"system_qty"`
	PhysicalQty  float64   `json:"physical_qty"`
	Variance     float64   `json:"variance"`
}

type CreateOpnameRequest struct {
	Location string             `json:"location"`
	Note     *string            `json:"note"`
	Lines    []OpnameLineInput  `json:"lines"`
	// AcknowledgeNoClosing lets a kitchen draft be created before today's closing.
	AcknowledgeNoClosing bool `json:"acknowledge_no_closing"`
}

type OpnameLineInput struct {
	ItemID      uuid.UUID `json:"item_id"`
	PhysicalQty float64   `json:"physical_qty"`
}
