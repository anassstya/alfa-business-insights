package repo

import (
	"context"
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
