package model

import (
	"encoding/json"
	"time"
)

type AnalysisStatus string

const (
	AnalysisStatusPending   AnalysisStatus = "pending"
	AnalysisStatusRunning   AnalysisStatus = "running"
	AnalysisStatusCompleted AnalysisStatus = "completed"
	AnalysisStatusFailed    AnalysisStatus = "failed"
)

type AnalysisStage string

const (
	AnalysisStageLoadingProfile   AnalysisStage = "loading_profile"
	AnalysisStageMappingExposures AnalysisStage = "mapping_exposures"
	AnalysisStagePlanning         AnalysisStage = "planning"
	AnalysisStageRetrieving       AnalysisStage = "retrieving"
	AnalysisStageAnalyzing        AnalysisStage = "analyzing"
	AnalysisStageValidating       AnalysisStage = "validating"
	AnalysisStageCompleted        AnalysisStage = "completed"
)

type StartAnalysisRequest struct {
	DemoUserID *int64  `json:"demo_user_id,omitempty"`
	Role       string  `json:"role"`
	Goal       *string `json:"goal,omitempty"`
}

type StartAnalysisResponse struct {
	JobID string `json:"job_id"`
}

type AnalysisJob struct {
	ID           string          `json:"job_id"`
	CompanyID    int64           `json:"company_id"`
	DemoUserID   *int64          `json:"demo_user_id"`
	Role         string          `json:"role"`
	Goal         *string         `json:"goal"`
	Status       AnalysisStatus  `json:"status"`
	Stage        *AnalysisStage  `json:"stage"`
	Result       json.RawMessage `json:"result"`
	ErrorMessage *string         `json:"error_message"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type AnalysisJobSummary struct {
	ID        string         `json:"job_id"`
	CompanyID int64          `json:"company_id"`
	Role      string         `json:"role"`
	Goal      *string        `json:"goal"`
	Status    AnalysisStatus `json:"status"`
	Stage     *AnalysisStage `json:"stage"`
	CreatedAt time.Time      `json:"created_at"`
}
