package dashboard

import (
	"context"
	"errors"
)

var ErrInvalidInput = errors.New("invalid input")

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Summary(ctx context.Context) (Summary, error) {
	wh, err := s.repo.ListWarehouseLowStock(ctx)
	if err != nil {
		return Summary{}, err
	}
	kit, err := s.repo.ListKitchenLowStock(ctx)
	if err != nil {
		return Summary{}, err
	}
	pending, err := s.repo.CountRequestsByStatus(ctx, "submitted")
	if err != nil {
		return Summary{}, err
	}
	awaiting, err := s.repo.CountRequestsByStatus(ctx, "approved")
	if err != nil {
		return Summary{}, err
	}
	inTransit, err := s.repo.CountRequestsByStatus(ctx, "transferred")
	if err != nil {
		return Summary{}, err
	}
	items, err := s.repo.CountActiveItems(ctx)
	if err != nil {
		return Summary{}, err
	}
	menus, err := s.repo.CountActiveMenus(ctx)
	if err != nil {
		return Summary{}, err
	}

	return Summary{
		WarehouseLowStock: len(wh),
		KitchenLowStock:   len(kit),
		PendingApprovals:  pending,
		AwaitingTransfer:  awaiting,
		InTransitRequests: inTransit,
		ActiveItems:       items,
		ActiveMenus:       menus,
		LeadTimeDays:      DefaultLeadTimeDays,
		OrderIntervalDays: DefaultOrderIntervalDays,
	}, nil
}

func (s *Service) LowStock(ctx context.Context, location string) ([]LowStockAlert, error) {
	switch location {
	case "", "all":
		wh, err := s.repo.ListWarehouseLowStock(ctx)
		if err != nil {
			return nil, err
		}
		kit, err := s.repo.ListKitchenLowStock(ctx)
		if err != nil {
			return nil, err
		}
		return append(wh, kit...), nil
	case "warehouse":
		return s.repo.ListWarehouseLowStock(ctx)
	case "kitchen":
		return s.repo.ListKitchenLowStock(ctx)
	default:
		return nil, ErrInvalidInput
	}
}
