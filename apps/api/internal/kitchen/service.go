package kitchen

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidInput         = errors.New("invalid input")
	ErrShortageNoteRequired = errors.New("shortage note required")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListMenus(ctx context.Context) ([]Menu, error) {
	return s.repo.ListMenus(ctx)
}

func (s *Service) GetMenu(ctx context.Context, id uuid.UUID) (Menu, error) {
	if id == uuid.Nil {
		return Menu{}, ErrInvalidInput
	}
	return s.repo.GetMenu(ctx, id)
}

func (s *Service) CreateMenu(ctx context.Context, req CreateMenuRequest) (Menu, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return Menu{}, ErrInvalidInput
	}
	lines, err := s.validateLines(ctx, req.Lines)
	if err != nil {
		return Menu{}, err
	}
	return s.repo.CreateMenu(ctx, name, lines)
}

func (s *Service) ReplaceRecipe(ctx context.Context, menuID uuid.UUID, req ReplaceRecipeRequest) (Menu, error) {
	if menuID == uuid.Nil {
		return Menu{}, ErrInvalidInput
	}
	lines, err := s.validateLines(ctx, req.Lines)
	if err != nil {
		return Menu{}, err
	}
	return s.repo.ReplaceRecipe(ctx, menuID, lines)
}

func (s *Service) PatchMenu(ctx context.Context, id uuid.UUID, req PatchMenuRequest) (Menu, error) {
	if id == uuid.Nil {
		return Menu{}, ErrInvalidInput
	}
	cur, err := s.repo.GetMenu(ctx, id)
	if err != nil {
		return Menu{}, err
	}
	name, active := cur.Name, cur.IsActive
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if name == "" {
			return Menu{}, ErrInvalidInput
		}
	}
	if req.IsActive != nil {
		active = *req.IsActive
	}
	return s.repo.UpdateMenu(ctx, id, name, active)
}

func (s *Service) validateLines(ctx context.Context, in []RecipeLineInput) ([]RecipeLineInput, error) {
	if len(in) == 0 {
		return nil, ErrInvalidInput
	}
	seen := make(map[uuid.UUID]struct{}, len(in))
	out := make([]RecipeLineInput, 0, len(in))
	for _, line := range in {
		if line.ItemID == uuid.Nil || line.QtyPerPaket <= 0 {
			return nil, ErrInvalidInput
		}
		if _, dup := seen[line.ItemID]; dup {
			return nil, ErrInvalidInput
		}
		ok, err := s.repo.ItemExists(ctx, line.ItemID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrNotFound
		}
		seen[line.ItemID] = struct{}{}
		out = append(out, line)
	}
	return out, nil
}

func (s *Service) ListKitchenStocks(ctx context.Context) ([]KitchenStock, error) {
	return s.repo.ListKitchenStocks(ctx)
}

type MenuPackageQty struct {
	MenuID   uuid.UUID
	QtyPaket float64
}

// ExpandMenus merges recipe lines for package quantities. requireActive rejects
// inactive menus (stock requests); closings pass false so usage of a menu that
// was just deactivated can still be recorded.
func (s *Service) ExpandMenus(ctx context.Context, packages []MenuPackageQty, requireActive bool) (map[uuid.UUID]float64, map[uuid.UUID]ItemMeta, error) {
	qtyByItem := map[uuid.UUID]float64{}
	metaByItem := map[uuid.UUID]ItemMeta{}
	for _, p := range packages {
		menu, err := s.repo.GetMenu(ctx, p.MenuID)
		if err != nil {
			return nil, nil, err
		}
		if (requireActive && !menu.IsActive) || len(menu.Lines) == 0 {
			return nil, nil, ErrInvalidInput
		}
		for _, line := range menu.Lines {
			qtyByItem[line.ItemID] += line.QtyPerPaket * p.QtyPaket
			if _, ok := metaByItem[line.ItemID]; !ok {
				meta, err := s.repo.GetItemMeta(ctx, line.ItemID)
				if err != nil {
					return nil, nil, err
				}
				metaByItem[line.ItemID] = meta
			}
		}
	}
	return qtyByItem, metaByItem, nil
}

func (s *Service) GetItemMeta(ctx context.Context, id uuid.UUID) (ItemMeta, error) {
	return s.repo.GetItemMeta(ctx, id)
}

func (s *Service) GetMenuName(ctx context.Context, id uuid.UUID) (Menu, error) {
	return s.repo.GetMenu(ctx, id)
}

func (s *Service) ListClosings(ctx context.Context) ([]MenuClosing, error) {
	return s.repo.ListClosings(ctx)
}

func (s *Service) GetClosing(ctx context.Context, id uuid.UUID) (MenuClosing, error) {
	if id == uuid.Nil {
		return MenuClosing{}, ErrInvalidInput
	}
	return s.repo.GetClosing(ctx, id)
}

func (s *Service) CreateClosing(ctx context.Context, createdBy uuid.UUID, req CreateClosingRequest) (MenuClosing, error) {
	if createdBy == uuid.Nil {
		return MenuClosing{}, ErrInvalidInput
	}
	if len(req.Packages) == 0 {
		return MenuClosing{}, ErrInvalidInput
	}
	dateStr := strings.TrimSpace(req.ClosingDate)
	if dateStr == "" {
		return MenuClosing{}, ErrInvalidInput
	}
	closingDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return MenuClosing{}, ErrInvalidInput
	}

	ins := make([]MenuPackageQty, 0, len(req.Packages))
	for _, p := range req.Packages {
		if p.MenuID == uuid.Nil || p.QtyPaket <= 0 {
			return MenuClosing{}, ErrInvalidInput
		}
		ins = append(ins, MenuPackageQty{MenuID: p.MenuID, QtyPaket: p.QtyPaket})
	}

	expanded, metas, err := s.ExpandMenus(ctx, ins, false)
	if err != nil {
		return MenuClosing{}, err
	}

	packages := make([]MenuClosingPackage, 0, len(req.Packages))
	for _, p := range req.Packages {
		menu, err := s.repo.GetMenu(ctx, p.MenuID)
		if err != nil {
			return MenuClosing{}, err
		}
		mid := p.MenuID
		packages = append(packages, MenuClosingPackage{
			MenuID:   &mid,
			MenuName: menu.Name,
			QtyPaket: p.QtyPaket,
		})
	}

	lines := make([]MenuClosingLine, 0, len(expanded))
	for itemID, qty := range expanded {
		meta := metas[itemID]
		lines = append(lines, MenuClosingLine{
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

	var shortageNote *string
	if req.AllowShortage {
		if req.ShortageNote == nil || strings.TrimSpace(*req.ShortageNote) == "" {
			return MenuClosing{}, ErrShortageNoteRequired
		}
		t := strings.TrimSpace(*req.ShortageNote)
		shortageNote = &t
	}

	return s.repo.CreateClosingAndConsume(ctx, NewClosingInput{
		ClosingDate:   closingDate,
		Note:          note,
		AllowShortage: req.AllowShortage,
		ShortageNote:  shortageNote,
		CreatedBy:     createdBy,
		Packages:      packages,
		Lines:         lines,
	})
}
