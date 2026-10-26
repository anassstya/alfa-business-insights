package mlclient

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"
)

type Chatter interface {
	Chat(context.Context, ChatRequest) (ChatResponse, error)
}
type ChatTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	JobID   string     `json:"job_id"`
	Message string     `json:"message"`
	History []ChatTurn `json:"history"`
}
type ChatResponse struct {
	JobID               string            `json:"job_id"`
	Answer              string            `json:"answer"`
	InsightRefs         []string          `json:"insight_refs"`
	EvidenceRefs        []string          `json:"evidence_refs"`
	Sources             []json.RawMessage `json:"sources"`
	InsufficientContext bool              `json:"insufficient_context"`
	Mode                string            `json:"mode"`
}

func (c *Client) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	var response ChatResponse
	result, err := c.post(ctx, "/internal/chat", req)
	if err != nil {
		return response, err
	}
	if err = json.Unmarshal(result, &response); err != nil {
		return response, fmt.Errorf("invalid ML chat response: %w", err)
	}
	if response.JobID != req.JobID || strings.TrimSpace(response.Answer) == "" || utf8.RuneCountInString(response.Answer) > 8000 {
		return ChatResponse{}, fmt.Errorf("invalid ML chat response identity or answer")
	}
	return response, nil
}
func (MockClient) Chat(ctx context.Context, req ChatRequest) (ChatResponse, error) {
	if err := ctx.Err(); err != nil {
		return ChatResponse{}, err
	}
	return ChatResponse{
		JobID: req.JobID, Answer: "BACKEND MOCK: ответ на вопрос «" + req.Message + "». Это демонстрация; реальные выводы ML не выполнялись.",
		InsightRefs: []string{}, EvidenceRefs: []string{}, Sources: []json.RawMessage{}, InsufficientContext: true, Mode: "fixture",
	}, nil
}
