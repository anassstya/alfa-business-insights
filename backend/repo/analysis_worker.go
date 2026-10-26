package repo

import (
	"context"
	"errors"

	"alfa-business-insights/backend/model"

	"github.com/jackc/pgx/v5"
)

func (r *AnalysisRepository) ClaimNextAnalysis(ctx context.Context) (*model.AnalysisJob, error) {
	var job model.AnalysisJob
	err := r.db.QueryRow(ctx, `
		UPDATE analysis_jobs AS jobs
		SET status = 'running', dispatched_at = clock_timestamp(),
			recovery_deadline = clock_timestamp() + INTERVAL '7 minutes', updated_at = clock_timestamp()
		FROM (
			SELECT id FROM analysis_jobs
			WHERE status = 'pending' AND dispatched_at IS NULL
			ORDER BY created_at, id
			FOR UPDATE SKIP LOCKED LIMIT 1
		) AS candidate
		WHERE jobs.id = candidate.id
		RETURNING jobs.id::text, jobs.company_id, jobs.demo_user_id, jobs.role, jobs.goal
	`).Scan(&job.ID, &job.CompanyID, &job.DemoUserID, &job.Role, &job.Goal)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	job.Status = model.AnalysisStatusRunning
	return &job, nil
}

func (r *AnalysisRepository) ExpireAnalyses(ctx context.Context) error {
	_, err := r.db.Exec(ctx, `
		UPDATE analysis_jobs
		SET status = 'failed',
			error_message = 'backend_recovery_timeout: execution outcome unknown; manual reconciliation required; no automatic retry',
			updated_at = clock_timestamp()
		WHERE status = 'running'
			AND COALESCE(recovery_deadline, created_at + INTERVAL '7 minutes') <= clock_timestamp()
	`)
	return err
}
