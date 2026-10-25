package repo

import (
	"context"

	"alfa-business-insights/backend/model"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DemoUserRepository struct {
	db *pgxpool.Pool
}

func NewDemoUserRepository(db *pgxpool.Pool) *DemoUserRepository {
	return &DemoUserRepository{db: db}
}

func (r *DemoUserRepository) GetAll(ctx context.Context) ([]model.DemoUser, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, synthetic_f, first_name, last_name
		FROM demo_users
		ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]model.DemoUser, 0)

	for rows.Next() {
		var user model.DemoUser

		if err := rows.Scan(
			&user.ID,
			&user.SyntheticF,
			&user.FirstName,
			&user.LastName,
		); err != nil {
			return nil, err
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
