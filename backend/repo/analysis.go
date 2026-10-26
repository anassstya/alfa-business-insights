package repo

import (
	"context"
	"encoding/json"
	"errors"

	"alfa-business-insights/backend/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalysisRepository struct {
	db *pgxpool.Pool
}

func NewAnalysisRepository(db *pgxpool.Pool) *AnalysisRepository {
	return &AnalysisRepository{db: db}
}

func (r *AnalysisRepository) GetCompanySyntheticU(ctx context.Context, companyID int64, demoUserID *int64) (string, bool, error) {
	var syntheticU string

	err := r.db.QueryRow(ctx, `
		SELECT c.synthetic_u
		FROM companies c
		WHERE c.id = $1
			AND c.cl_type = 'CLIENT'
			AND (
				$2::bigint IS NULL
				OR EXISTS (
					SELECT 1
					FROM demo_users u
					JOIN person_company_links pcl
						ON u.synthetic_f = pcl.synthetic_f
					WHERE u.id = $2
						AND pcl.synthetic_u = c.synthetic_u
				)
			)
	`, companyID, demoUserID).Scan(&syntheticU)

	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}

	if err != nil {
		return "", false, err
	}

	return syntheticU, true, nil
}

func (r *AnalysisRepository) RoleExists(ctx context.Context, role string) (bool, error) {
	var exists bool

	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM roles
			WHERE code = $1
		)
	`, role).Scan(&exists)

	return exists, err
}

func (r *AnalysisRepository) Create(ctx context.Context, job model.AnalysisJob) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO analysis_jobs (
			id,
			company_id,
			demo_user_id,
			role,
			goal
		)
		VALUES ($1::uuid, $2, $3, $4, $5)
	`,
		job.ID,
		job.CompanyID,
		job.DemoUserID,
		job.Role,
		job.Goal,
	)

	return err
}

func (r *AnalysisRepository) GetByID(ctx context.Context, jobID string) (*model.AnalysisJob, error) {
	var job model.AnalysisJob
	var status string
	var stage *string

	err := r.db.QueryRow(ctx, `
		SELECT
			id::text,
			company_id,
			demo_user_id,
			role,
			goal,
			status,
			stage,
			result,
			error_message,
			created_at,
			updated_at
		FROM analysis_jobs
		WHERE id = $1::uuid
	`, jobID).Scan(
		&job.ID,
		&job.CompanyID,
		&job.DemoUserID,
		&job.Role,
		&job.Goal,
		&status,
		&stage,
		&job.Result,
		&job.ErrorMessage,
		&job.CreatedAt,
		&job.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	job.Status = model.AnalysisStatus(status)

	if stage != nil {
		value := model.AnalysisStage(*stage)
		job.Stage = &value
	}

	return &job, nil
}

func (r *AnalysisRepository) ListByDemoUserID(ctx context.Context, demoUserID int64) ([]model.AnalysisJobSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id::text,
			company_id,
			role,
			goal,
			status,
			stage,
			created_at
		FROM analysis_jobs
		WHERE demo_user_id = $1
		ORDER BY created_at DESC, id DESC
	`, demoUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := make([]model.AnalysisJobSummary, 0)

	for rows.Next() {
		var job model.AnalysisJobSummary
		var status string
		var stage *string

		err := rows.Scan(
			&job.ID,
			&job.CompanyID,
			&job.Role,
			&job.Goal,
			&status,
			&stage,
			&job.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		job.Status = model.AnalysisStatus(status)

		if stage != nil {
			value := model.AnalysisStage(*stage)
			job.Stage = &value
		}

		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return jobs, nil
}

func (r *AnalysisRepository) UpdateFromEvent(
	ctx context.Context,
	jobID string,
	status model.AnalysisStatus,
	stage *model.AnalysisStage,
	result json.RawMessage,
	errorMessage *string,
) (bool, error) {
	var id string

	var stageValue any
	if stage != nil {
		stageValue = string(*stage)
	}

	var resultValue any
	if len(result) > 0 {
		resultValue = string(result)
	}

	err := r.db.QueryRow(ctx, `
		UPDATE analysis_jobs
		SET
			status = CASE
				WHEN status IN ('completed', 'failed') THEN status
				ELSE $2::text
			END,
			stage = CASE
				WHEN status IN ('completed', 'failed') THEN stage
				ELSE COALESCE($3::text, stage)
			END,
			result = CASE
				WHEN status IN ('completed', 'failed') THEN result
				ELSE COALESCE($4::jsonb, result)
			END,
			error_message = CASE
				WHEN status IN ('completed', 'failed') THEN error_message
				ELSE COALESCE($5::text, error_message)
			END,
			dispatched_at = CASE
				WHEN status IN ('completed', 'failed') THEN dispatched_at
				ELSE COALESCE(dispatched_at, clock_timestamp())
			END,
			recovery_deadline = CASE
				WHEN status IN ('completed', 'failed') THEN recovery_deadline
				ELSE COALESCE(recovery_deadline, clock_timestamp() + INTERVAL '7 minutes')
			END,
			updated_at = CASE
				WHEN status IN ('completed', 'failed') THEN updated_at
				ELSE NOW()
			END
		WHERE id = $1::uuid
		RETURNING id::text
	`,
		jobID,
		string(status),
		stageValue,
		resultValue,
		errorMessage,
	).Scan(&id)

	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}

	if err != nil {
		return false, err
	}

	return true, nil
}
