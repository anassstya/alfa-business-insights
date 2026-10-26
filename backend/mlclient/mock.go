package mlclient

import (
	"context"
	"encoding/json"
)

type MockClient struct{}

func (MockClient) Analyze(ctx context.Context, req AnalysisRequest) (json.RawMessage, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		SchemaVersion string   `json:"schema_version"`
		JobID         string   `json:"job_id"`
		RunID         string   `json:"run_id"`
		CompanyID     string   `json:"company_id"`
		CompanyRowID  int64    `json:"company_row_id"`
		Role          string   `json:"role"`
		Goal          *string  `json:"goal"`
		AsOf          string   `json:"as_of"`
		Mode          string   `json:"mode"`
		Outcome       string   `json:"outcome"`
		Insights      []any    `json:"insights"`
		Evidence      []any    `json:"evidence"`
		Warnings      []string `json:"warnings"`
	}{
		SchemaVersion: "1.0", JobID: req.JobID, RunID: req.JobID,
		CompanyID: "U_MOCK", CompanyRowID: req.CompanyID, Role: req.Role, Goal: req.Goal,
		AsOf: "2026-01-01T00:00:00Z", Mode: "fixture", Outcome: "no_relevant_evidence",
		Insights: []any{}, Evidence: []any{},
		Warnings: []string{"BACKEND MOCK: no ML, profile lookup or research was performed; U_MOCK, run_id and as_of are test placeholders"},
	})
}
