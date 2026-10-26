package mlclient

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMockOffline(t *testing.T) {
	client, err := FromEnvironment(func(key string) string {
		if key == "ML_MODE" {
			return "mock"
		}
		t.Fatalf("mock read %s", key)
		return ""
	})
	if err != nil {
		t.Fatal(err)
	}
	req := AnalysisRequest{JobID: "3fa85f64-5717-4562-b3fc-2c963f66afa6", CompanyID: 70, Role: "cfo"}
	a, err := client.Analyze(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := client.Analyze(context.Background(), req)
	var result map[string]any
	if err := json.Unmarshal(a, &result); err != nil {
		t.Fatal(err)
	}
	if string(a) != string(b) || result["job_id"] != req.JobID || result["company_row_id"] != float64(70) || result["mode"] != "fixture" || result["outcome"] != "no_relevant_evidence" {
		t.Fatalf("unexpected mock: %s", a)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := client.Analyze(ctx, req); !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v", err)
	}
}

func TestConfiguration(t *testing.T) {
	for _, tc := range []struct {
		name, mode, url, token, timeout string
		valid                           bool
	}{
		{"default", "", "http://localhost", "test", "", true},
		{"http", "http", "https://localhost", "test", "2s", true},
		{"unknown", "oops", "", "", "", false},
		{"missing URL", "http", "", "test", "", false},
		{"bad scheme", "http", "ftp://localhost", "test", "", false},
		{"optional token", "http", "http://localhost", "", "", true},
		{"bad timeout", "http", "http://localhost", "test", "bad", false},
		{"zero timeout", "http", "http://localhost", "test", "0s", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			values := map[string]string{"ML_MODE": tc.mode, "ML_SERVICE_URL": tc.url, "ML_SERVICE_TOKEN": tc.token, "ML_HTTP_TIMEOUT": tc.timeout}
			_, err := FromEnvironment(func(k string) string { return values[k] })
			if (err == nil) != tc.valid {
				t.Fatalf("got %v", err)
			}
		})
	}
}

func TestHTTPClient(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
		wantErr    bool
	}{
		{"success", `{"outcome":"ok"}`, 200, false},
		{"unavailable", `secret upstream details`, 503, true},
		{"invalid JSON", `{`, 200, true},
		{"oversize", strings.Repeat(" ", 8<<20) + `{}`, 200, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, _ := io.ReadAll(r.Body)
				if r.Method != "POST" || r.URL.Path != "/internal/analyze-company" || r.Header.Get("Authorization") != "Bearer test" || r.Header.Get("Content-Type") != "application/json" || !strings.Contains(string(body), `"company_id":70`) {
					t.Errorf("unexpected request: %s %s %s", r.Method, r.URL.Path, body)
				}
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, tc.body)
			}))
			defer server.Close()
			result, err := NewClient(server.URL+"/", "test").Analyze(context.Background(), AnalysisRequest{CompanyID: 70})
			if (err != nil) != tc.wantErr {
				t.Fatalf("got %v", err)
			}
			if err == nil && string(result) != tc.body {
				t.Fatal("response changed")
			}
			if err != nil && strings.Contains(err.Error(), "secret upstream details") {
				t.Fatal("upstream body leaked")
			}
		})
	}
}

func TestHTTPTimeoutAndUnavailable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
		case <-time.After(100 * time.Millisecond):
		}
	}))
	client := NewClient(server.URL, "test")
	client.httpClient.Timeout = 20 * time.Millisecond
	_, err := client.Analyze(context.Background(), AnalysisRequest{})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("got %v", err)
	}
	server.Close()
	_, err = client.Analyze(context.Background(), AnalysisRequest{})
	if err == nil {
		t.Fatal("expected unavailable error")
	}
}

func TestOptionalServiceTokenForAnalysisAndChat(t *testing.T) {
	const jobID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
	for _, token := range []string{"", "service-test"} {
		t.Run("token="+token, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if token == "" {
					if _, exists := r.Header["Authorization"]; exists {
						t.Error("empty token must omit Authorization entirely")
					}
				} else if r.Header.Get("Authorization") != "Bearer "+token {
					t.Error("service token not forwarded")
				}
				w.Header().Set("Content-Type", "application/json")
				switch r.URL.Path {
				case "/internal/analyze-company":
					io.WriteString(w, `{"outcome":"ok"}`)
				case "/internal/chat":
					io.WriteString(w, `{"job_id":"`+jobID+`","answer":"test answer"}`)
				default:
					t.Errorf("unexpected path %s", r.URL.Path)
					w.WriteHeader(404)
				}
			}))
			defer server.Close()
			client, err := FromEnvironment(func(key string) string {
				switch key {
				case "ML_MODE":
					return "http"
				case "ML_SERVICE_URL":
					return server.URL
				case "ML_SERVICE_TOKEN":
					return token
				}
				return ""
			})
			if err != nil {
				t.Fatal(err)
			}
			if _, err = client.Analyze(context.Background(), AnalysisRequest{JobID: jobID, CompanyID: 1, Role: "cfo"}); err != nil {
				t.Fatal(err)
			}
			chatter, ok := client.(Chatter)
			if !ok {
				t.Fatal("HTTP client has no chat adapter")
			}
			if _, err = chatter.Chat(context.Background(), ChatRequest{JobID: jobID, Message: "test question", History: []ChatTurn{}}); err != nil {
				t.Fatal(err)
			}
		})
	}
}
