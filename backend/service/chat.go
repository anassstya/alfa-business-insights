package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
)

var (
	ErrChatInvalidInput = errors.New("invalid chat input")
	ErrChatJobNotFound  = errors.New("analysis job not found")
	ErrChatNotReady     = errors.New("analysis result not ready")
	ErrChatUnavailable  = errors.New("ML chat unavailable")
	ErrChatML           = errors.New("ML chat failed")
)

var chatUUIDPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$`,
)

type ChatService struct {
	chatRepo     *repo.ChatRepository
	analysisRepo *repo.AnalysisRepository
	ml           mlclient.Chatter
}

func NewChatService(
	chatRepo *repo.ChatRepository,
	analysisRepo *repo.AnalysisRepository,
	ml mlclient.Chatter,
) *ChatService {
	return &ChatService{
		chatRepo:     chatRepo,
		analysisRepo: analysisRepo,
		ml:           ml,
	}
}

func (s *ChatService) checkJob(
	ctx context.Context,
	jobID string,
) (*model.AnalysisJob, error) {
	if !chatUUIDPattern.MatchString(jobID) {
		return nil, ErrChatInvalidInput
	}

	job, err := s.analysisRepo.GetByID(ctx, jobID)
	if err != nil {
		return nil, err
	}

	if job == nil {
		return nil, ErrChatJobNotFound
	}

	return job, nil
}

func (s *ChatService) GetMessages(
	ctx context.Context,
	jobID string,
) ([]model.ChatMessage, error) {
	if _, err := s.checkJob(ctx, jobID); err != nil {
		return nil, err
	}

	return s.chatRepo.GetMessages(ctx, jobID)
}

func (s *ChatService) SaveUserMessage(
	ctx context.Context,
	jobID string,
	content string,
) (string, error) {
	content = strings.TrimSpace(content)

	if content == "" || utf8.RuneCountInString(content) > 4000 {
		return "", ErrChatInvalidInput
	}

	// Maximum time for one complete chat exchange.
	ctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	job, err := s.checkJob(ctx, jobID)
	if err != nil {
		return "", err
	}

	jobID = job.ID

	if job.Status != model.AnalysisStatusCompleted ||
		len(job.Result) == 0 ||
		string(job.Result) == "null" {
		return "", ErrChatNotReady
	}

	if s.ml == nil {
		return "", ErrChatUnavailable
	}

	userID, err := newChatUUID()
	if err != nil {
		return "", err
	}

	assistantID, err := newChatUUID()
	if err != nil {
		return "", err
	}

	user := model.ChatMessage{
		ID:      userID,
		Role:    "user",
		Content: content,
	}

	err = s.chatRepo.SaveExchange(
		ctx,
		jobID,
		user,
		func(messages []model.ChatMessage) (model.ChatMessage, error) {
			history := make([]mlclient.ChatTurn, 0, len(messages))

			for _, message := range messages {
				runes := []rune(message.Content)

				if len(runes) > 4000 {
					runes = runes[:4000]
				}

				history = append(history, mlclient.ChatTurn{
					Role:    message.Role,
					Content: string(runes),
				})
			}

			answer, err := s.ml.Chat(ctx, mlclient.ChatRequest{
				JobID:   jobID,
				Message: content,
				History: history,
			})

			if err != nil {
				return model.ChatMessage{}, fmt.Errorf(
					"%w: %w",
					ErrChatML,
					err,
				)
			}

			if answer.JobID != jobID ||
				strings.TrimSpace(answer.Answer) == "" ||
				utf8.RuneCountInString(answer.Answer) > 8000 {
				return model.ChatMessage{}, ErrChatML
			}

			return model.ChatMessage{
				ID:      assistantID,
				Role:    "assistant",
				Content: answer.Answer,
			}, nil
		},
	)

	if err != nil {
		return "", err
	}

	return userID, nil
}

func newChatUUID() (string, error) {
	var b [16]byte

	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}

	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		b[0:4],
		b[4:6],
		b[6:8],
		b[8:10],
		b[10:16],
	), nil
}
