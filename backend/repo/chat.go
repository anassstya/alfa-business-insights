package repo

import (
	"context"

	"alfa-business-insights/backend/model"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ChatRepository struct {
	db *pgxpool.Pool
}

func NewChatRepository(db *pgxpool.Pool) *ChatRepository {
	return &ChatRepository{db: db}
}

func (r *ChatRepository) GetMessages(ctx context.Context, jobID string) ([]model.ChatMessage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id::text,
			role,
			content,
			created_at
		FROM chat_messages
		WHERE job_id = $1::uuid
		ORDER BY created_at ASC, id ASC
	`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]model.ChatMessage, 0)

	for rows.Next() {
		var message model.ChatMessage

		err := rows.Scan(
			&message.ID,
			&message.Role,
			&message.Content,
			&message.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		messages = append(messages, message)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return messages, nil
}

func (r *ChatRepository) CreateMessage(ctx context.Context, jobID string, message model.ChatMessage) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO chat_messages (
			id,
			job_id,
			role,
			content
		)
		VALUES ($1::uuid, $2::uuid, $3, $4)
	`,
		message.ID,
		jobID,
		message.Role,
		message.Content,
	)

	return err
}
