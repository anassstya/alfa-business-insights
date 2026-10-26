package mlclient

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"
)

func TestChatHTTPContract(t *testing.T) {
	req := ChatRequest{JobID: "3fa85f64-5717-4562-b3fc-2c963f66afa6", Message: "Почему?", History: []ChatTurn{{Role: "user", Content: "Первый вопрос"}, {Role: "assistant", Content: "Ответ"}}}
	for _, tc := range []struct {
		name, body string
		status     int
		wantErr    bool
	}{
		{"answer", `{"job_id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","answer":"Объяснение","sources":[],"insufficient_context":true}`, 200, false},
		{"wrong session", `{"job_id":"different","answer":"answer"}`, 200, true},
		{"blank answer", `{"job_id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","answer":" "}`, 200, true},
		{"invalid JSON", `{`, 200, true},
		{"unavailable", `{"detail":"unavailable"}`, 503, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var got ChatRequest
				if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
					t.Error(err)
				}
				if r.Method != "POST" || r.URL.Path != "/internal/chat" || r.Header.Get("Authorization") != "Bearer local-test" || !reflect.DeepEqual(got, req) {
					t.Errorf("unexpected chat request: %+v", got)
				}
				w.WriteHeader(tc.status)
				w.Write([]byte(tc.body))
			}))
			defer server.Close()
			answer, err := NewClient(server.URL, "local-test").Chat(context.Background(), req)
			if (err != nil) != tc.wantErr {
				t.Fatalf("got %+v %v", answer, err)
			}
		})
	}
}
func TestChatMockAndCancellation(t *testing.T) {
	req := ChatRequest{JobID: "test", Message: "Вопрос"}
	a, err := (MockClient{}).Chat(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := (MockClient{}).Chat(context.Background(), req)
	if !reflect.DeepEqual(a, b) || a.JobID != req.JobID || a.Answer == "" || a.Mode != "fixture" {
		t.Fatalf("unexpected mock %+v", a)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := (MockClient{}).Chat(ctx, req); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
		case <-time.After(100 * time.Millisecond):
		}
	}))
	defer server.Close()
	ctx, stop := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer stop()
	if _, err := NewClient(server.URL, "test").Chat(ctx, req); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("got %v", err)
	}
}
