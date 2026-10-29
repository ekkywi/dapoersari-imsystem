package dashboard

import "github.com/google/uuid"

// Default operational rules (not restaurant hours — tunable later via config table).
const (
	DefaultLeadTimeDays      = 3
	DefaultOrderIntervalDays = 7
)

type Summary struct {
	WarehouseLowStock       int `json:"warehouse_low_stock"`
	KitchenLowStock         int `json:"kitchen_low_stock"`
	PendingApprovals        int `json:"pending_approvals"`
	AwaitingTransfer        int `json:"awaiting_transfer"`
	InTransitRequests       int `json:"in_transit_requests"`
	ActiveItems             int `json:"active_items"`
	ActiveMenus             int `json:"active_menus"`
	LeadTimeDays            int `json:"lead_time_days"`
	OrderIntervalDays       int `json:"order_interval_days"`
}

type LowStockAlert struct {
	ItemID       uuid.UUID `json:"item_id"`
	SKU          string    `json:"sku"`
	Name         string    `json:"name"`
	UnitCode     string    `json:"unit_code"`
	Location     string    `json:"location"`
	Qty          float64   `json:"qty"`
	InTransit    float64   `json:"in_transit"`
	EffectiveQty float64   `json:"effective_qty"`
	MinStock     float64   `json:"min_stock"`
	Level        string    `json:"level"` // low | critical
}
