package history

import (
	"time"

	"github.com/google/uuid"
)

type StockEntry struct {
	ID        uuid.UUID  `json:"id"`
	ItemID    uuid.UUID  `json:"item_id"`
	ItemSKU   string     `json:"item_sku"`
	ItemName  string     `json:"item_name"`
	UnitCode  string     `json:"unit_code"`
	Location  string     `json:"location"`
	Delta     float64    `json:"delta"`
	QtyAfter  float64    `json:"qty_after"`
	Reason    string     `json:"reason"`
	RefType   *string    `json:"ref_type,omitempty"`
	RefID     *uuid.UUID `json:"ref_id,omitempty"`
	CreatedBy *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}
