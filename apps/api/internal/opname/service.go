package opname

import (
	"context"
	"errors"
	"strings"

	"dapoersari-imsystem/apps/api/internal/auth"

	"github.com/google/uuid"
)

var (
	ErrInvalidInput = errors.New("invalid input")
	ErrForbidden    = errors.New("forbidden")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, location string) ([]Opname, error) {
	if location != "" && location != LocationWarehouse && location != LocationKitchen {
		return nil, ErrInvalidInput
	}
	return s.repo.List(ctx, location)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (Opname, error) {
	if id == uuid.Nil {
		return Opname{}, ErrInvalidInput
	}
	return s.repo.Get(ctx, id)
}

func canMutateLocation(role, location string) bool {
	switch role {
	case auth.RoleSuperAdmin:
		return true
	case auth.RoleAdminGudang:
		return location == LocationWarehouse
	case auth.RoleAdminKitchen:
		return location == LocationKitchen
	default:
		return false
	}
}

func (s *Service) Create(ctx context.Context, actor uuid.UUID, role string, req CreateOpnameRequest) (Opname, error) {
	if actor == uuid.Nil {
		return Opname{}, ErrInvalidInput
	}
	loc := strings.TrimSpace(req.Location)
	if loc != LocationWarehouse && loc != LocationKitchen {
		return Opname{}, ErrInvalidInput
	}
	if !canMutateLocation(role, loc) {
		return Opname{}, ErrForbidden
	}
	if len(req.Lines) == 0 {
		return Opname{}, ErrInvalidInput
	}
	// Kitchen counts must be taken after today's usage is posted: the draft
	// snapshot is the baseline the variance is measured against.
	if loc == LocationKitchen && !req.AcknowledgeNoClosing {
		has, err := s.repo.HasClosingToday(ctx)
		if err != nil {
			return Opname{}, err
		}
		if !has {
			return Opname{}, ErrClosingMissing
		}
	}

	seen := map[uuid.UUID]struct{}{}
	lines := make([]OpnameLine, 0, len(req.Lines))
	for _, in := range req.Lines {
		if in.ItemID == uuid.Nil || in.PhysicalQty < 0 {
			return Opname{}, ErrInvalidInput
		}
		if _, dup := seen[in.ItemID]; dup {
			return Opname{}, ErrInvalidInput
		}
		seen[in.ItemID] = struct{}{}

		var snap ItemSnap
		var err error
		if loc == LocationWarehouse {
			snap, err = s.repo.GetWarehouseSnap(ctx, in.ItemID)
		} else {
			snap, err = s.repo.GetKitchenSnap(ctx, in.ItemID)
		}
		if err != nil {
			return Opname{}, err
		}
		lines = append(lines, OpnameLine{
			ItemID:      snap.ItemID,
			ItemSKU:     snap.SKU,
			ItemName:    snap.Name,
			UnitCode:    snap.UnitCode,
			SystemQty:   snap.Qty,
			PhysicalQty: in.PhysicalQty,
		})
	}

	var note *string
	if req.Note != nil {
		t := strings.TrimSpace(*req.Note)
		if t != "" {
			note = &t
		}
	}

	return s.repo.CreateDraft(ctx, NewOpnameInput{
		Location:  loc,
		Note:      note,
		CreatedBy: actor,
		Lines:     lines,
	})
}

// ErrClosingMissing: kitchen draft created before today's shift closing.
var ErrClosingMissing = errors.New("closing missing")

// ErrClosingAfterDraft: a closing was posted after the kitchen draft snapshot.
// Its usage is usually already reflected in the physical count, so applying
// the draft variance would deduct that usage twice. A new draft is required.
var ErrClosingAfterDraft = errors.New("closing after draft")

func (s *Service) Confirm(ctx context.Context, id, actor uuid.UUID, role string) (Opname, error) {
	if id == uuid.Nil || actor == uuid.Nil {
		return Opname{}, ErrInvalidInput
	}
	o, err := s.repo.Get(ctx, id)
	if err != nil {
		return Opname{}, err
	}
	if o.Status != StatusDraft {
		return Opname{}, ErrConflict
	}
	if !canMutateLocation(role, o.Location) {
		return Opname{}, ErrForbidden
	}
	if o.Location == LocationKitchen {
		n, err := s.repo.CountClosingsSince(ctx, o.CreatedAt)
		if err != nil {
			return Opname{}, err
		}
		if n > 0 {
			return Opname{}, ErrClosingAfterDraft
		}
	}
	if err := s.repo.Confirm(ctx, o, actor); err != nil {
		return Opname{}, err
	}
	return s.repo.Get(ctx, id)
}
