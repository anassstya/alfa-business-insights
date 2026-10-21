package repo

import (
	"context"
	"fmt"

	"alfa-business-insights/backend/model"

	"github.com/jackc/pgx/v5/pgxpool"
)

type RoleRepository struct {
	db *pgxpool.Pool
}

func NewRoleRepository(db *pgxpool.Pool) *RoleRepository {
	return &RoleRepository{db: db}
}

func (r *RoleRepository) GetAll(ctx context.Context) ([]model.Role, error) {
	rows, err := r.db.Query(ctx, `
		SELECT code, full_name
		FROM roles
		ORDER BY code
	`)
	if err != nil {
		return nil, fmt.Errorf("get roles: %w", err)
	}
	defer rows.Close()

	roles := make([]model.Role, 0, 7)

	for rows.Next() {
		var role model.Role

		err := rows.Scan(&role.Code, &role.FullName)
		if err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}

		roles = append(roles, role)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate roles: %w", err)
	}

	return roles, nil
}
