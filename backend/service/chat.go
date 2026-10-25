package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
)

var (
	ErrChatInvalidInput = errors.New("invalid chat input")
	ErrChatJobNotFound  = errors.New("analysis job not found")
)

var chatUUIDPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$`,
)

type ChatService struct {
	chatRepo     *repo.ChatRepository
	analysisRepo *repo.AnalysisRepository
}

func NewChatService(chatRepo *repo.ChatRepository, analysisRepo *repo.AnalysisRepository) *ChatService {
	return &ChatService{
		chatRepo:     chatRepo,
		analysisRepo: analysisRepo,
	}
}

func (s *ChatService) checkJob(ctx context.Context, jobID string) error {
	if !chatUUIDPattern.MatchString(jobID) {
		return ErrChatInvalidInput
	}

	job, err := s.analysisRepo.GetByID(ctx, jobID)
	if err != nil {
		return err
	}

	if job == nil {
		return ErrChatJobNotFound
	}

	return nil
}

func (s *ChatService) GetMessages(ctx context.Context, jobID string) ([]model.ChatMessage, error) {
	if err := s.checkJob(ctx, jobID); err != nil {
		return nil, err
	}

	return s.chatRepo.GetMessages(ctx, jobID)
}

func (s *ChatService) SaveUserMessage(ctx context.Context, jobID string, content string) (string, error) {
	if strings.TrimSpace(content) == "" {
		return "", ErrChatInvalidInput
	}

	if err := s.checkJob(ctx, jobID); err != nil {
		return "", err
	}

	messageID, err := newChatUUID()
	if err != nil {
		return "", err
	}

	message := model.ChatMessage{
		ID:      messageID,
		Role:    "user",
		Content: content,
	}

	if err := s.chatRepo.CreateMessage(ctx, jobID, message); err != nil {
		return "", err
	}

	return messageID, nil
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
