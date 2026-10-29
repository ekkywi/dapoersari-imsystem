package history

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var ErrInvalidInput = errors.New("invalid input")

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListStock(ctx context.Context, location, itemIDStr string, limit int) ([]StockEntry, error) {
	if location != "" && location != "warehouse" && location != "kitchen" {
		return nil, ErrInvalidInput
	}
	f := ListFilter{Location: location, Limit: limit}
	if itemIDStr != "" {
		id, err := uuid.Parse(itemIDStr)
		if err != nil {
			return nil, ErrInvalidInput
		}
		f.ItemID = &id
	}
	return s.repo.ListStock(ctx, f)
}
