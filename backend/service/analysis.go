package service

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/model"
)

var (
	ErrInvalidInput     = errors.New("invalid input")
	ErrInvalidRole      = errors.New("invalid role")
	ErrCompanyNotFound  = errors.New("company not found or unavailable")
	ErrAnalysisNotFound = errors.New("analysis not found")
)

type AnalysisRepository interface {
	RoleExists(context.Context, string) (bool, error)
	GetCompanySyntheticU(context.Context, int64, *int64) (string, bool, error)
	Create(context.Context, model.AnalysisJob) error
	GetByID(context.Context, string) (*model.AnalysisJob, error)
	ListByDemoUserID(context.Context, int64) ([]model.AnalysisJobSummary, error)
	UpdateFromEvent(context.Context, string, model.AnalysisStatus, *model.AnalysisStage, json.RawMessage, *string) (bool, error)
}

type AnalysisService struct {
	repo AnalysisRepository
	ml   mlclient.Analyzer
}

func NewAnalysisService(r AnalysisRepository, ml mlclient.Analyzer) *AnalysisService {
	return &AnalysisService{
		repo: r,
		ml:   ml,
	}
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

func (s *AnalysisService) StartAnalysis(ctx context.Context, companyID int64, req model.StartAnalysisRequest) (string, error) {
	_, err := s.PrepareAnalysis(ctx, companyID, req)
	if err != nil {
		return "", err
	}

	jobID, err := newAnalysisUUID()
	if err != nil {
		return "", err
	}

	job := model.AnalysisJob{
		ID:         jobID,
		CompanyID:  companyID,
		DemoUserID: req.DemoUserID,
		Role:       req.Role,
		Goal:       req.Goal,
		Status:     model.AnalysisStatusPending,
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return "", err
	}

	return jobID, nil
}

func (s *AnalysisService) runMLAnalysis(parent context.Context, job model.AnalysisJob) {
	ctx, cancel := context.WithTimeout(
		parent,
		6*time.Minute,
	)
	defer cancel()

	result, err := s.ml.Analyze(
		ctx,
		mlclient.AnalysisRequest{
			JobID:     job.ID,
			CompanyID: job.CompanyID,
			Role:      job.Role,
			Goal:      job.Goal,
		},
	)

	if err != nil {
		log.Printf(
			"ML analysis failed for job %s: %v",
			job.ID,
			err,
		)
		if parent.Err() != nil {
			return
		}
		s.failAnalysis(job.ID, err)
		return
	}

	var response struct {
		Outcome string `json:"outcome"`
	}

	if err := json.Unmarshal(result, &response); err != nil {
		log.Printf(
			"Invalid ML result for job %s: %v",
			job.ID,
			err,
		)
		s.failAnalysis(job.ID, err)
		return
	}

	var status model.AnalysisStatus
	var stage *model.AnalysisStage

	switch response.Outcome {
	case "ok", "partial", "no_relevant_evidence":
		status = model.AnalysisStatusCompleted

		completed := model.AnalysisStageCompleted
		stage = &completed

	case "failed":
		status = model.AnalysisStatusFailed

	default:
		err := fmt.Errorf(
			"unknown ML outcome: %q",
			response.Outcome,
		)

		log.Printf(
			"ML analysis failed for job %s: %v",
			job.ID,
			err,
		)

		s.failAnalysis(job.ID, err)
		return
	}

	updateCtx, updateCancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer updateCancel()

	_, err = s.repo.UpdateFromEvent(
		updateCtx,
		job.ID,
		status,
		stage,
		result,
		nil,
	)

	if err != nil {
		log.Printf(
			"Failed to save ML result for job %s: %v",
			job.ID,
			err,
		)
	}
}

func (s *AnalysisService) failAnalysis(jobID string, analysisErr error) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	message := analysisErr.Error()

	_, err := s.repo.UpdateFromEvent(
		ctx,
		jobID,
		model.AnalysisStatusFailed,
		nil,
		nil,
		&message,
	)

	if err != nil {
		log.Printf(
			"Failed to update analysis job %s: %v",
			jobID,
			err,
		)
	}
}

func newAnalysisUUID() (string, error) {
	var b [16]byte

	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}

	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		b[0:4],
		b[4:6],
		b[6:8],
		b[8:10],
		b[10:16],
	), nil
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

func (s *AnalysisService) UpdateAnalysisFromEvent(
	ctx context.Context,
	jobID string,
	status model.AnalysisStatus,
	stage *model.AnalysisStage,
	result json.RawMessage,
	errorMessage *string,
) error {
	if strings.TrimSpace(jobID) == "" {
		return ErrInvalidInput
	}

	switch status {
	case model.AnalysisStatusRunning,
		model.AnalysisStatusCompleted,
		model.AnalysisStatusFailed:
	default:
		return ErrInvalidInput
	}

	if stage != nil {
		switch *stage {
		case model.AnalysisStageLoadingProfile,
			model.AnalysisStageMappingExposures,
			model.AnalysisStagePlanning,
			model.AnalysisStageRetrieving,
			model.AnalysisStageAnalyzing,
			model.AnalysisStageValidating,
			model.AnalysisStageCompleted:
		default:
			return ErrInvalidInput
		}
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
