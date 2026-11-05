package transfer

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

const (
	StatusSubmitted   = "submitted"
	StatusApproved    = "approved"
	StatusTransferred = "transferred"
	StatusReceived    = "received"
	StatusRejected    = "rejected"
	StatusCancelled   = "cancelled"
)

type StockRequest struct {
	ID            uuid.UUID             `json:"id"`
	Status        string                `json:"status"`
	Note          *string               `json:"note,omitempty"`
	CreatedBy     uuid.UUID             `json:"created_by"`
	CreatedAt     time.Time             `json:"created_at"`
	ApprovedBy    *uuid.UUID            `json:"approved_by,omitempty"`
	ApprovedAt    *time.Time            `json:"approved_at,omitempty"`
	TransferredBy *uuid.UUID            `json:"transferred_by,omitempty"`
	TransferredAt *time.Time            `json:"transferred_at,omitempty"`
	ReceivedBy    *uuid.UUID            `json:"received_by,omitempty"`
	ReceivedAt    *time.Time            `json:"received_at,omitempty"`
	RejectedBy    *uuid.UUID            `json:"rejected_by,omitempty"`
	RejectedAt    *time.Time            `json:"rejected_at,omitempty"`
	RejectReason  *string               `json:"reject_reason,omitempty"`
	CancelledBy   *uuid.UUID            `json:"cancelled_by,omitempty"`
	CancelledAt   *time.Time            `json:"cancelled_at,omitempty"`
	CancelReason  *string               `json:"cancel_reason,omitempty"`
	Packages      []StockRequestPackage `json:"packages,omitempty"`
	Lines         []StockRequestLine    `json:"lines,omitempty"`
}

type StockRequestPackage struct {
	ID        uuid.UUID  `json:"id"`
	RequestID uuid.UUID  `json:"request_id"`
	MenuID    *uuid.UUID `json:"menu_id,omitempty"`
	MenuName  string     `json:"menu_name"`
	QtyPaket  float64    `json:"qty_paket"`
}

type StockRequestLine struct {
	ID           uuid.UUID `json:"id"`
	RequestID    uuid.UUID `json:"request_id"`
	ItemID       uuid.UUID `json:"item_id"`
	ItemSKU      string    `json:"item_sku"`
	ItemName     string    `json:"item_name"`
	UnitCode     string    `json:"unit_code"`
	CategoryName *string   `json:"category_name,omitempty"`
	Qty          float64   `json:"qty"`
	// QtyTransferred is set when the warehouse ships; may be less than Qty.
	QtyTransferred *float64 `json:"qty_transferred,omitempty"`
	// QtyReceived is what the kitchen actually counted on arrival.
	QtyReceived *float64 `json:"qty_received,omitempty"`
	ReceiveNote *string  `json:"receive_note,omitempty"`
}

type CreateRequestPackageInput struct {
	MenuID   uuid.UUID `json:"menu_id"`
	QtyPaket float64   `json:"qty_paket"`
}

type CreateRequestItemInput struct {
	ItemID uuid.UUID `json:"item_id"`
	Qty    float64   `json:"qty"`
}

type CreateStockRequestRequest struct {
	Note       *string                     `json:"note"`
	Packages   []CreateRequestPackageInput `json:"packages"`
	ExtraItems []CreateRequestItemInput    `json:"extra_items"`
}

type RejectRequestRequest struct {
	Reason string `json:"reason"`
}

type CancelRequestRequest struct {
	Reason string `json:"reason"`
}

type ApproveRequestRequest struct {
	AllowShortage bool `json:"allow_shortage"`
}

type TransferLineInput struct {
	LineID uuid.UUID   `json:"line_id"`
	Qty    json.Number `json:"qty"`
}

type TransferRequestRequest struct {
	// Lines is optional; omitted lines ship their full requested qty.
	Lines         []TransferLineInput `json:"lines"`
	AllowShortage bool                `json:"allow_shortage"`
}

type ReceiveLineInput struct {
	LineID      uuid.UUID   `json:"line_id"`
	QtyReceived json.Number `json:"qty_received"`
	Note        *string     `json:"note"`
}

type ReceiveRequestRequest struct {
	// Lines is optional; omitted lines are received at qty_transferred.
	Lines []ReceiveLineInput `json:"lines"`
}
