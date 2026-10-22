package repo

import (
	"context"

	"alfa-business-insights/backend/model"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CompanyRepository struct {
	db *pgxpool.Pool
}

func NewCompanyRepository(db *pgxpool.Pool) *CompanyRepository {
	return &CompanyRepository{db: db}
}

func (r *CompanyRepository) GetByDemoUserID(ctx context.Context, userID int64) ([]model.Company, bool, error) {
	var userExists bool

	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM demo_users
			WHERE id = $1
		)
	`, userID).Scan(&userExists)

	if err != nil {
		return nil, false, err
	}

	if !userExists {
		return nil, false, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT
			c.id,
			c.synthetic_u,
			c.city,
			c.region,
			c.revenue_company,
			c.mainokved_name,
			c.mainokved_code,
			c.org_type,
			c.okfs_name,
			c.company_age_years_gradation,
			c.eco_mark_label,
			c.amount_workers_fns_gradation,
			c.cl_type
		FROM demo_users u
		JOIN person_company_links pcl
			ON u.synthetic_f = pcl.synthetic_f
		JOIN companies c
			ON pcl.synthetic_u = c.synthetic_u
		WHERE u.id = $1
		ORDER BY c.id
	`, userID)

	if err != nil {
		return nil, true, err
	}
	defer rows.Close()

	companies := make([]model.Company, 0)

	for rows.Next() {
		var company model.Company

		err := rows.Scan(
			&company.ID,
			&company.SyntheticU,
			&company.City,
			&company.Region,
			&company.RevenueCompany,
			&company.MainOKVEDName,
			&company.MainOKVEDCode,
			&company.OrgType,
			&company.OKFSName,
			&company.CompanyAgeYearsGradation,
			&company.EcoMarkLabel,
			&company.AmountWorkersFNSGradation,
			&company.CLType,
		)

		if err != nil {
			return nil, true, err
		}

		companies = append(companies, company)
	}

	if err := rows.Err(); err != nil {
		return nil, true, err
	}

	return companies, true, nil
}

func (r *CompanyRepository) GetAll(ctx context.Context, limit int, offset int) ([]model.Company, int64, error) {
	var total int64

	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM companies
	`).Scan(&total)

	if err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			id,
			synthetic_u,
			city,
			region,
			revenue_company,
			mainokved_name,
			mainokved_code,
			org_type,
			okfs_name,
			company_age_years_gradation,
			eco_mark_label,
			amount_workers_fns_gradation,
			cl_type
		FROM companies
		ORDER BY id
		LIMIT $1 OFFSET $2
	`, limit, offset)

	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	companies := make([]model.Company, 0)

	for rows.Next() {
		var company model.Company

		err := rows.Scan(
			&company.ID,
			&company.SyntheticU,
			&company.City,
			&company.Region,
			&company.RevenueCompany,
			&company.MainOKVEDName,
			&company.MainOKVEDCode,
			&company.OrgType,
			&company.OKFSName,
			&company.CompanyAgeYearsGradation,
			&company.EcoMarkLabel,
			&company.AmountWorkersFNSGradation,
			&company.CLType,
		)

		if err != nil {
			return nil, 0, err
		}

		companies = append(companies, company)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return companies, total, nil
}
