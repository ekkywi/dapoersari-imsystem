package activity

import "context"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, limit int) ([]Entry, error) {
	return s.repo.List(ctx, limit)
}

func (s *Service) Repo() *Repository {
	return s.repo
}
