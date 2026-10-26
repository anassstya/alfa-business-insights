package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/model"
)

type memoryAnalysisRepo struct {
	job     model.AnalysisJob
	updated chan model.AnalysisJob
}

func (*memoryAnalysisRepo) RoleExists(context.Context, string) (bool, error) { return true, nil }
func (*memoryAnalysisRepo) GetCompanySyntheticU(context.Context, int64, *int64) (string, bool, error) {
	return "U_TEST", true, nil
}
func (r *memoryAnalysisRepo) Create(_ context.Context, j model.AnalysisJob) error {
	r.job = j
	return nil
}
func (r *memoryAnalysisRepo) GetByID(context.Context, string) (*model.AnalysisJob, error) {
	return &r.job, nil
}

func (*memoryAnalysisRepo) ListByDemoUserID(context.Context, int64) ([]model.AnalysisJobSummary, error) {
	return nil, nil
}

func (r *memoryAnalysisRepo) UpdateFromEvent(_ context.Context, id string, status model.AnalysisStatus, stage *model.AnalysisStage, result json.RawMessage, message *string) (bool, error) {
	r.updated <- model.AnalysisJob{ID: id, Status: status, Stage: stage, Result: result, ErrorMessage: message}
	return true, nil
}

type stubAnalyzer struct {
	result string
	err    error
}

func (s stubAnalyzer) Analyze(context.Context, mlclient.AnalysisRequest) (json.RawMessage, error) {
	return json.RawMessage(s.result), s.err
}

func TestRunMLAnalysis(t *testing.T) {
	for _, tc := range []struct {
		name   string
		client mlclient.Analyzer
		status model.AnalysisStatus
	}{
		{"mock", mlclient.MockClient{}, model.AnalysisStatusCompleted},
		{"partial", stubAnalyzer{result: `{"outcome":"partial"}`}, model.AnalysisStatusCompleted},
		{"failed", stubAnalyzer{result: `{"outcome":"failed"}`}, model.AnalysisStatusFailed},
		{"unknown", stubAnalyzer{result: `{"outcome":"unknown"}`}, model.AnalysisStatusFailed},
		{"invalid", stubAnalyzer{result: `{`}, model.AnalysisStatusFailed},
		{"timeout", stubAnalyzer{err: context.DeadlineExceeded}, model.AnalysisStatusFailed},
		{"unavailable", stubAnalyzer{err: errors.New("unavailable")}, model.AnalysisStatusFailed},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := &memoryAnalysisRepo{updated: make(chan model.AnalysisJob, 1)}
			s := NewAnalysisService(r, tc.client)
			s.runMLAnalysis(context.Background(), model.AnalysisJob{ID: "3fa85f64-5717-4562-b3fc-2c963f66afa6", CompanyID: 70, Role: "cfo"})
			got := <-r.updated
			if got.Status != tc.status {
				t.Fatalf("got %s", got.Status)
			}
			if tc.status == model.AnalysisStatusCompleted && (got.Stage == nil || *got.Stage != model.AnalysisStageCompleted || !json.Valid(got.Result)) {
				t.Fatalf("incomplete result: %+v", got)
			}
		})
	}
}

func TestStartAnalysisPersistsPendingWithoutCallingML(t *testing.T) {
	r := &memoryAnalysisRepo{updated: make(chan model.AnalysisJob, 1)}
	s := NewAnalysisService(r, stubAnalyzer{err: errors.New("must not be called by POST")})
	id, err := s.StartAnalysis(context.Background(), 70, model.StartAnalysisRequest{Role: "cfo"})
	if err != nil {
		t.Fatal(err)
	}
	if r.job.ID != id || r.job.Status != model.AnalysisStatusPending {
		t.Fatalf("unexpected job: %+v", r.job)
	}
	select {
	case <-r.updated:
		t.Fatal("POST ran ML without a queue claim")
	default:
	}
}

func TestShutdownDoesNotFinalizeUnknownMLExecution(t *testing.T) {
	r := &memoryAnalysisRepo{updated: make(chan model.AnalysisJob, 1)}
	s := NewAnalysisService(r, stubAnalyzer{err: context.Canceled})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	s.runMLAnalysis(ctx, model.AnalysisJob{ID: "3fa85f64-5717-4562-b3fc-2c963f66afa6", Status: model.AnalysisStatusRunning})
	select {
	case <-r.updated:
		t.Fatal("shutdown prematurely finalized a possibly active ML execution")
	default:
	}
}
