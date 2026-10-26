package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/model"
)

type chatMock struct {
	mlclient.MockClient
	mu       sync.Mutex
	requests []mlclient.ChatRequest
	err      error
	entered  chan struct{}
	release  chan struct{}
}

func (m *chatMock) Chat(ctx context.Context, r mlclient.ChatRequest) (mlclient.ChatResponse, error) {
	m.mu.Lock()
	m.requests = append(m.requests, r)
	m.mu.Unlock()
	if m.entered != nil {
		close(m.entered)
		select {
		case <-m.release:
		case <-ctx.Done():
			return mlclient.ChatResponse{}, ctx.Err()
		}
	}
	if m.err != nil {
		return mlclient.ChatResponse{}, m.err
	}
	return m.MockClient.Chat(ctx, r)
}
func TestPostgresChatIntegration(t *testing.T) {
	db := integrationDB(t)
	job := recoveryJob(t, db)
	ml := &chatMock{}
	server := httptest.NewServer(newMux(db, ml))
	defer server.Close()
	client := server.Client()
	url := server.URL + "/api/v1/analysis/jobs/" + job.ID + "/chat/messages"
	getHistory := func() []model.ChatMessage {
		var history model.ChatMessagesResponse
		if err := json.Unmarshal(requestJSON(t, client, "GET", url, "", "", 200), &history); err != nil {
			t.Fatal(err)
		}
		return history.Messages
	}
	if history := getHistory(); history == nil || len(history) != 0 {
		t.Fatalf("expected empty array: %+v", history)
	}
	requestJSON(t, client, "POST", url, `{"content":"Вопрос"}`, "", 409)
	if _, err := db.Exec(context.Background(), `UPDATE analysis_jobs SET status='completed',result='{"outcome":"no_relevant_evidence"}'::jsonb WHERE id=$1::uuid`, job.ID); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 8; i++ {
		body := fmt.Sprintf(`{"content":"Вопрос %d"}`, i)
		var result model.SendChatMessageResponse
		if err := json.Unmarshal(requestJSON(t, client, "POST", url, body, "", 201), &result); err != nil {
			t.Fatal(err)
		}
		history := getHistory()
		if len(history) != (i+1)*2 || history[len(history)-2].ID != result.MessageID || history[len(history)-2].Role != "user" || history[len(history)-1].Role != "assistant" || !strings.Contains(history[len(history)-1].Content, "BACKEND MOCK") {
			t.Fatalf("bad exchange: %+v", history)
		}
	}
	ml.mu.Lock()
	last := ml.requests[len(ml.requests)-1]
	ml.mu.Unlock()
	if len(last.History) != 12 || last.JobID != job.ID || last.Message != "Вопрос 7" || last.History[0].Content != "Вопрос 1" || last.History[11].Role != "assistant" {
		t.Fatalf("bad ML context: %+v", last)
	}
	before := getHistory()
	// ML errors and timeouts leave the persisted history unchanged.
	for _, tc := range []struct {
		err    error
		status int
	}{{errors.New("mock unavailable"), 502}, {context.DeadlineExceeded, 504}} {
		failed := &chatMock{err: tc.err}
		other := httptest.NewServer(newMux(db, failed))
		requestJSON(t, client, "POST", other.URL+"/api/v1/analysis/jobs/"+job.ID+"/chat/messages", `{"content":"fail"}`, "", tc.status)
		other.Close()
		if !reflect.DeepEqual(before, getHistory()) {
			t.Fatal("failed exchange partially persisted")
		}
	}
	// Force a failure of the assistant INSERT inside the test schema. Neither
	// message may survive the transaction, even after ML has returned an answer.
	if _, err := db.Exec(context.Background(), `ALTER TABLE chat_messages ADD CONSTRAINT test_answer_rejected CHECK (role <> 'assistant' OR position('rollback' in content)=0)`); err != nil {
		t.Fatal(err)
	}
	requestJSON(t, client, "POST", url, `{"content":"rollback"}`, "", 500)
	if !reflect.DeepEqual(before, getHistory()) {
		t.Fatal("SQL failure left a partial exchange")
	}
	if _, err := db.Exec(context.Background(), `ALTER TABLE chat_messages DROP CONSTRAINT test_answer_rejected`); err != nil {
		t.Fatal(err)
	}

	// A separate backend instance cannot interleave a turn for the same session.
	gate := &chatMock{entered: make(chan struct{}), release: make(chan struct{})}
	gated := httptest.NewServer(newMux(db, gate))
	defer gated.Close()
	defer close(gate.release)
	done := make(chan error, 1)
	go func() {
		resp, err := http.Post(gated.URL+"/api/v1/analysis/jobs/"+job.ID+"/chat/messages", "application/json", strings.NewReader(`{"content":"concurrent"}`))
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode != 201 {
				err = fmt.Errorf("got %d", resp.StatusCode)
			}
		}
		done <- err
	}()
	select {
	case <-gate.entered:
	case <-time.After(5 * time.Second):
		t.Fatal("chat request did not enter Mock")
	}
	requestJSON(t, client, "POST", url, `{"content":"other"}`, "", 409)
	gate.release <- struct{}{}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{`{"content":" "}`, `{"content":"x","extra":1}`, `{"content":"x"} {}`, fmt.Sprintf(`{"content":%q}`, strings.Repeat("я", 4001))} {
		requestJSON(t, client, "POST", url, body, "", 400)
	}
	missing := server.URL + "/api/v1/analysis/jobs/00000000-0000-4000-8000-000000000000/chat/messages"
	requestJSON(t, client, "POST", missing, `{"content":"question"}`, "", 404)
	// Failed analyses also cannot be used as a chat session.
	failedJob := recoveryJob(t, db)
	if _, err := db.Exec(context.Background(), `UPDATE analysis_jobs SET status='failed' WHERE id=$1::uuid`, failedJob.ID); err != nil {
		t.Fatal(err)
	}
	requestJSON(t, client, "POST", server.URL+"/api/v1/analysis/jobs/"+failedJob.ID+"/chat/messages", `{"content":"question"}`, "", 409)
}
