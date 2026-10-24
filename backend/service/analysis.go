package service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
)

var (
	ErrInvalidInput    = errors.New("invalid input")
	ErrInvalidRole     = errors.New("invalid role")
	ErrCompanyNotFound = errors.New("company not found or unavailable")
)

type AnalysisService struct {
	repo *repo.AnalysisRepository
}

func NewAnalysisService(r *repo.AnalysisRepository) *AnalysisService {
	return &AnalysisService{repo: r}
}

func (s *AnalysisService) PrepareAnalysis(ctx context.Context, companyID int64, req model.StartAnalysisRequest) (string, error) {
	if companyID <= 0 || strings.TrimSpace(req.Role) == "" {
		return "", ErrInvalidInput
	}

	if req.DemoUserID != nil && *req.DemoUserID <= 0 {
		return "", ErrInvalidInput
	}

	if req.Goal != nil && utf8.RuneCountInString(*req.Goal) > 1000 {
		return "", ErrInvalidInput
	}

	roleExists, err := s.repo.RoleExists(ctx, req.Role)
	if err != nil {
		return "", err
	}

	if !roleExists {
		return "", ErrInvalidRole
	}

	syntheticU, found, err := s.repo.GetCompanySyntheticU(
		ctx,
		companyID,
		req.DemoUserID,
	)
	if err != nil {
		return "", err
	}

	if !found {
		return "", ErrCompanyNotFound
	}

	return syntheticU, nil
}
