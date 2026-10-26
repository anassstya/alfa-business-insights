package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

// The ML chat draft calls the existing public GET, not the write-only callback.
// Exercise that nested read while the backend chat transaction is open, using
// HTTP adapters in both directions and only the dedicated test PostgreSQL.
func TestPostgresMLReadsBackendResult(t *testing.T) {
	db := integrationDB(t)
	job := recoveryJob(t, db)
	result, err := (mlclient.MockClient{}).Analyze(context.Background(), mlclient.AnalysisRequest{JobID: job.ID, CompanyID: job.CompanyID, Role: job.Role})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(context.Background(), `UPDATE analysis_jobs SET status='completed',result=$2::jsonb WHERE id=$1::uuid`, job.ID, string(result)); err != nil {
		t.Fatal(err)
	}
	var expected any
	if err = json.Unmarshal(result, &expected); err != nil {
		t.Fatal(err)
	}
	backendURL := make(chan string, 1)
	readDone := make(chan error, 1)
	fakeML := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var question mlclient.ChatRequest
		if r.Method != "POST" || r.URL.Path != "/internal/chat" || r.Header.Get("Authorization") != "Bearer local-ml-test" {
			readDone <- fmt.Errorf("unexpected ML request")
			w.WriteHeader(400)
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&question); err != nil {
			readDone <- err
			w.WriteHeader(400)
			return
		}
		base := <-backendURL
		client := &http.Client{Timeout: 3 * time.Second}
		// Current OpenAPI deliberately permits anonymous GET. Optional service
		// Authorization must not alter its response or require callback credentials.
		for _, token := range []string{"", "optional-ml-backend-token"} {
			req, err := http.NewRequest("GET", base+"/api/v1/analysis/jobs/"+question.JobID, nil)
			if err != nil {
				readDone <- err
				w.WriteHeader(500)
				return
			}
			if token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			resp, err := client.Do(req)
			if err != nil {
				readDone <- err
				w.WriteHeader(500)
				return
			}
			var saved model.AnalysisJob
			err = json.NewDecoder(resp.Body).Decode(&saved)
			resp.Body.Close()
			if err != nil {
				readDone <- err
				w.WriteHeader(500)
				return
			}
			var got any
			if err = json.Unmarshal(saved.Result, &got); err != nil {
				readDone <- err
				w.WriteHeader(500)
				return
			}
			if resp.StatusCode != 200 || saved.ID != job.ID || saved.Status != model.AnalysisStatusCompleted || !reflect.DeepEqual(got, expected) {
				readDone <- fmt.Errorf("ML cannot read the full saved result: status %d job %+v", resp.StatusCode, saved)
				w.WriteHeader(500)
				return
			}
		}
		readDone <- nil
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mlclient.ChatResponse{JobID: question.JobID, Answer: "Read saved analysis through backend GET", Mode: "fixture"})
	}))
	defer fakeML.Close()
	server := httptest.NewServer(newMux(db, mlclient.NewClient(fakeML.URL, "local-ml-test")))
	defer server.Close()
	backendURL <- server.URL
	client := &http.Client{Timeout: 5 * time.Second}
	requestJSON(t, client, "POST", server.URL+"/api/v1/analysis/jobs/"+job.ID+"/chat/messages", `{"content":"Explain saved result"}`, "", 201)
	if err := <-readDone; err != nil {
		t.Fatal(err)
	}
	var after json.RawMessage
	if err = db.QueryRow(context.Background(), `SELECT result FROM analysis_jobs WHERE id=$1::uuid`, job.ID).Scan(&after); err != nil {
		t.Fatal(err)
	}
	var got any
	if err = json.Unmarshal(after, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, expected) {
		t.Fatal("ML read altered the analysis result")
	}

	t.Run("database unavailable returns safe JSON error", func(t *testing.T) {
		closed, err := pgxpool.NewWithConfig(context.Background(), db.Config())
		if err != nil {
			t.Fatal(err)
		}
		closed.Close()
		failed := httptest.NewServer(newMux(closed, mlclient.MockClient{}))
		defer failed.Close()
		body := requestJSON(t, client, "GET", failed.URL+"/api/v1/analysis/jobs/"+job.ID, "", "", 500)
		var message map[string]string
		if err = json.Unmarshal(body, &message); err != nil || message["error"] != "Не удалось получить анализ" {
			t.Fatalf("unsafe error: %s", body)
		}
	})
	// The callback is a different endpoint, with independent mandatory auth.
	resp, err := client.Get(server.URL + "/api/v1/internal/analysis/events")
	if err != nil {
		t.Fatal(err)
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 405 {
		t.Fatalf("callback incorrectly serves reads: %d", resp.StatusCode)
	}
}
