package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
)

var (
	ErrInvalidInput     = errors.New("invalid input")
	ErrInvalidRole      = errors.New("invalid role")
	ErrCompanyNotFound  = errors.New("company not found or unavailable")
	ErrAnalysisNotFound = errors.New("analysis not found")
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

func (s *AnalysisService) ListAnalysisJobs(ctx context.Context, demoUserID int64) ([]model.AnalysisJobSummary, error) {
	if demoUserID <= 0 {
		return nil, ErrInvalidInput
	}

	return s.repo.ListByDemoUserID(ctx, demoUserID)
}

func (s *AnalysisService) GetAnalysisJob(ctx context.Context, jobID string) (*model.AnalysisJob, error) {
	if strings.TrimSpace(jobID) == "" {
		return nil, ErrInvalidInput
	}

	job, err := s.repo.GetByID(ctx, jobID)
	if err != nil {
		return nil, err
	}

	if job == nil {
		return nil, ErrAnalysisNotFound
	}

	return job, nil
}

func (s *AnalysisService) UpdateAnalysisFromEvent(ctx context.Context, jobID string, status string, stage *string, result json.RawMessage, errorMessage *string) error {
	if strings.TrimSpace(jobID) == "" || strings.TrimSpace(status) == "" {
		return ErrInvalidInput
	}

	if len(result) > 0 && !json.Valid(result) {
		return ErrInvalidInput
	}

	found, err := s.repo.UpdateFromEvent(
		ctx,
		jobID,
		status,
		stage,
		result,
		errorMessage,
	)
	if err != nil {
		return err
	}

	if !found {
		return ErrAnalysisNotFound
	}

	return nil
}
