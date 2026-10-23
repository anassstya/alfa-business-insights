package model

type StartAnalysisRequest struct {
	DemoUserID *int64 `json:"demo_user_id,omitempty"`
	Role       string `json:"role"`
}

type StartAnalysisResponse struct {
	JobID string `json:"job_id"`
}
