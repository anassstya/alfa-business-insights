package repo

import (
	"context"
	"errors"
	"time"

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
		SELECT id::text, role, content, created_at
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
		if err := rows.Scan(
			&message.ID,
			&message.Role,
			&message.Content,
			&message.CreatedAt,
		); err != nil {
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
		INSERT INTO chat_messages (id, job_id, role, content)
		VALUES ($1::uuid, $2::uuid, $3, $4)
	`, message.ID, jobID, message.Role, message.Content)
	return err
}

var ErrChatBusy = errors.New("another chat turn is in progress")

func (r *ChatRepository) SaveExchange(
	ctx context.Context,
	jobID string,
	user model.ChatMessage,
	reply func([]model.ChatMessage) (model.ChatMessage, error),
) error {
	conn, err := r.db.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	var locked bool
	if err := conn.QueryRow(ctx, `
		SELECT pg_try_advisory_lock(hashtextextended($1, 1))
	`, jobID).Scan(&locked); err != nil {
		return err
	}
	if !locked {
		return ErrChatBusy
	}

	defer func() {
		unlockCtx, cancel := context.WithTimeout(
			context.Background(),
			5*time.Second,
		)
		defer cancel()

		var unlocked bool
		err := conn.QueryRow(unlockCtx, `
			SELECT pg_advisory_unlock(hashtextextended($1, 1))
		`, jobID).Scan(&unlocked)

		if err != nil || !unlocked {
			closeCtx, closeCancel := context.WithTimeout(
				context.Background(),
				5*time.Second,
			)
			defer closeCancel()

			_ = conn.Conn().Close(closeCtx)
		}
	}()

	rows, err := conn.Query(ctx, `
		SELECT id::text, role, content, created_at
		FROM (
			SELECT id, role, content, created_at
			FROM chat_messages
			WHERE job_id = $1::uuid
			ORDER BY created_at DESC, id DESC
			LIMIT 12
		) AS recent
		ORDER BY created_at, id
	`, jobID)
	if err != nil {
		return err
	}

	messages := make([]model.ChatMessage, 0, 12)
	for rows.Next() {
		var message model.ChatMessage

		if err := rows.Scan(
			&message.ID,
			&message.Role,
			&message.Content,
			&message.CreatedAt,
		); err != nil {
			rows.Close()
			return err
		}

		messages = append(messages, message)
	}

	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}

	assistant, err := reply(messages)
	if err != nil {
		return err
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		WITH stamp AS (
			SELECT GREATEST(
				clock_timestamp(),
				COALESCE(
					MAX(created_at) + INTERVAL '1 microsecond',
					clock_timestamp()
				)
			) AS at
			FROM chat_messages
			WHERE job_id = $1::uuid
		)
		INSERT INTO chat_messages (
			id,
			job_id,
			role,
			content,
			created_at
		)
		SELECT
			$2::uuid,
			$1::uuid,
			'user',
			$3,
			at
		FROM stamp
		UNION ALL
		SELECT
			$4::uuid,
			$1::uuid,
			'assistant',
			$5,
			at + INTERVAL '1 microsecond'
		FROM stamp
	`, jobID, user.ID, user.Content, assistant.ID, assistant.Content)

	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
