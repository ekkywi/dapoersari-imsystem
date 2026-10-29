package transfer

import (
	"context"
	"errors"
	"strings"

	"dapoersari-imsystem/apps/api/internal/kitchen"

	"github.com/google/uuid"
)

var ErrInvalidInput = errors.New("invalid input")

type Service struct {
	repo    *Repository
	kitchen *kitchen.Service
}

func NewService(repo *Repository, kitchenSvc *kitchen.Service) *Service {
	return &Service{repo: repo, kitchen: kitchenSvc}
}

func (s *Service) List(ctx context.Context) ([]StockRequest, error) {
	return s.repo.ListRequests(ctx)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (StockRequest, error) {
	if id == uuid.Nil {
		return StockRequest{}, ErrInvalidInput
	}
	return s.repo.GetRequest(ctx, id)
}

func (s *Service) Create(ctx context.Context, createdBy uuid.UUID, req CreateStockRequestRequest) (StockRequest, error) {
	if createdBy == uuid.Nil {
		return StockRequest{}, ErrInvalidInput
	}
	if len(req.Packages) == 0 && len(req.ExtraItems) == 0 {
		return StockRequest{}, ErrInvalidInput
	}

	qtyByItem := map[uuid.UUID]float64{}
	metaByItem := map[uuid.UUID]kitchen.ItemMeta{}
	var packages []StockRequestPackage

	if len(req.Packages) > 0 {
		ins := make([]kitchen.MenuPackageQty, 0, len(req.Packages))
		for _, p := range req.Packages {
			if p.MenuID == uuid.Nil || p.QtyPaket <= 0 {
				return StockRequest{}, ErrInvalidInput
			}
			ins = append(ins, kitchen.MenuPackageQty{MenuID: p.MenuID, QtyPaket: p.QtyPaket})
		}
		expanded, metas, err := s.kitchen.ExpandMenus(ctx, ins)
		if err != nil {
			if errors.Is(err, kitchen.ErrNotFound) {
				return StockRequest{}, ErrNotFound
			}
			if errors.Is(err, kitchen.ErrInvalidInput) {
				return StockRequest{}, ErrInvalidInput
			}
			return StockRequest{}, err
		}
		for id, q := range expanded {
			qtyByItem[id] += q
		}
		for id, m := range metas {
			metaByItem[id] = m
		}
		for _, p := range req.Packages {
			menu, err := s.kitchen.GetMenuName(ctx, p.MenuID)
			if err != nil {
				return StockRequest{}, err
			}
			mid := p.MenuID
			packages = append(packages, StockRequestPackage{
				MenuID:   &mid,
				MenuName: menu.Name,
				QtyPaket: p.QtyPaket,
			})
		}
	}

	for _, extra := range req.ExtraItems {
		if extra.ItemID == uuid.Nil || extra.Qty <= 0 {
			return StockRequest{}, ErrInvalidInput
		}
		qtyByItem[extra.ItemID] += extra.Qty
		if _, ok := metaByItem[extra.ItemID]; !ok {
			meta, err := s.kitchen.GetItemMeta(ctx, extra.ItemID)
			if err != nil {
				if errors.Is(err, kitchen.ErrNotFound) {
					return StockRequest{}, ErrNotFound
				}
				return StockRequest{}, err
			}
			metaByItem[extra.ItemID] = meta
		}
	}

	if len(qtyByItem) == 0 {
		return StockRequest{}, ErrInvalidInput
	}

	lines := make([]StockRequestLine, 0, len(qtyByItem))
	for itemID, qty := range qtyByItem {
		meta := metaByItem[itemID]
		lines = append(lines, StockRequestLine{
			ItemID:   itemID,
			ItemSKU:  meta.SKU,
			ItemName: meta.Name,
			UnitCode: meta.UnitCode,
			Qty:      qty,
		})
	}

	var note *string
	if req.Note != nil {
		t := strings.TrimSpace(*req.Note)
		if t != "" {
			note = &t
		}
	}

	return s.repo.CreateRequest(ctx, NewRequestInput{
		Note:      note,
		CreatedBy: createdBy,
		Packages:  packages,
		Lines:     lines,
	})
}

func (s *Service) Approve(ctx context.Context, id, actor uuid.UUID) (StockRequest, error) {
	if err := s.repo.UpdateStatus(ctx, id, StatusSubmitted, StatusApproved, actor, nil); err != nil {
		return StockRequest{}, err
	}
	return s.repo.GetRequest(ctx, id)
}

func (s *Service) Reject(ctx context.Context, id, actor uuid.UUID, reason string) (StockRequest, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return StockRequest{}, ErrInvalidInput
	}
	if err := s.repo.UpdateStatus(ctx, id, StatusSubmitted, StatusRejected, actor, &reason); err != nil {
		return StockRequest{}, err
	}
	return s.repo.GetRequest(ctx, id)
}

func (s *Service) Transfer(ctx context.Context, id, actor uuid.UUID) (StockRequest, error) {
	req, err := s.repo.GetRequest(ctx, id)
	if err != nil {
		return StockRequest{}, err
	}
	if req.Status != StatusApproved {
		return StockRequest{}, ErrConflict
	}
	if err := s.repo.TransferStock(ctx, req, actor); err != nil {
		return StockRequest{}, err
	}
	return s.repo.GetRequest(ctx, id)
}

func (s *Service) Receive(ctx context.Context, id, actor uuid.UUID) (StockRequest, error) {
	req, err := s.repo.GetRequest(ctx, id)
	if err != nil {
		return StockRequest{}, err
	}
	if req.Status != StatusTransferred {
		return StockRequest{}, ErrConflict
	}
	if err := s.repo.ReceiveStock(ctx, req, actor); err != nil {
		return StockRequest{}, err
	}
	return s.repo.GetRequest(ctx, id)
}
