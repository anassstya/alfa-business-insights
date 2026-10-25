package repo

import (
	"alfa-business-insights/backend/model"
	"context"
	"encoding/json"
	"errors"

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
		&job.Status,
		&job.Stage,
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

		err := rows.Scan(
			&job.ID,
			&job.CompanyID,
			&job.Role,
			&job.Goal,
			&job.Status,
			&job.Stage,
			&job.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return jobs, nil
}

func (r *AnalysisRepository) UpdateFromEvent(ctx context.Context, jobID string, status string, stage *string, result json.RawMessage, errorMessage *string) (bool, error) {
	var id string

	err := r.db.QueryRow(ctx, `
		UPDATE analysis_jobs
		SET
			status = $2,
			stage = COALESCE($3, stage),
			result = COALESCE($4::jsonb, result),
			error_message = COALESCE($5, error_message),
			updated_at = NOW()
		WHERE id = $1::uuid
		RETURNING id::text
	`,
		jobID,
		status,
		stage,
		result,
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
