package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
	"alfa-business-insights/backend/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

func integrationDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	return integrationDBWithRecovery(t, true)
}

func integrationDBWithRecovery(t *testing.T, recovery bool) *pgxpool.Pool {
	t.Helper()
	if os.Getenv("RUN_POSTGRES_INTEGRATION") != "1" {
		t.Skip("set RUN_POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL")
	}
	// Never read DATABASE_URL or .env. Only the dedicated local test database is allowed.
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Fatal("TEST_DATABASE_URL is required")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal("invalid TEST_DATABASE_URL")
	}
	c := cfg.ConnConfig
	if c.Database != "alfa_insights_test" || c.User != "alfa_test" || (c.Host != "127.0.0.1" && c.Host != "localhost") {
		t.Fatal("require local alfa_insights_test database and alfa_test user")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	admin, err := pgxpool.NewWithConfig(ctx, cfg.Copy())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	if err = admin.Ping(ctx); err != nil {
		t.Fatal("explicitly enabled PostgreSQL unavailable: ", err)
	}
	var suffix [8]byte
	if _, err = rand.Read(suffix[:]); err != nil {
		t.Fatal(err)
	}
	schema := "integration_" + hex.EncodeToString(suffix[:])
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		// Drop only the random schema created by this run.
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	migrations := []string{"001_init.sql", "003_demo_users.sql", "004_company_contexts.sql", "005_analysis_jobs.sql", "006_chat_messages.sql"}
	if recovery {
		migrations = append(migrations, "007_analysis_recovery.sql")
	}
	for _, name := range migrations {
		sql, err := os.ReadFile(filepath.Join("..", "..", "database", "migrations", name))
		if err != nil {
			t.Fatal(err)
		}
		if _, err = db.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("migration %s: %v", name, err)
		}
	}
	return db
}

type gatedMock struct {
	release chan struct{}
	once    sync.Once
}

func (m *gatedMock) open() { m.once.Do(func() { close(m.release) }) }
func (m *gatedMock) Analyze(ctx context.Context, r mlclient.AnalysisRequest) (json.RawMessage, error) {
	select {
	case <-m.release:
		return (mlclient.MockClient{}).Analyze(ctx, r)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

type failingMock struct {
	result json.RawMessage
	err    error
}

func (m failingMock) Analyze(context.Context, mlclient.AnalysisRequest) (json.RawMessage, error) {
	return m.result, m.err
}

func requestJSON(t *testing.T, c *http.Client, method, url, body, token string, status int) []byte {
	t.Helper()
	req, err := http.NewRequest(method, url, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != status {
		t.Fatalf("%s %s: got %d want %d: %s", method, url, resp.StatusCode, status, data)
	}
	return data
}
func readJob(t *testing.T, c *http.Client, url string) model.AnalysisJob {
	t.Helper()
	var j model.AnalysisJob
	if err := json.Unmarshal(requestJSON(t, c, "GET", url, "", "", 200), &j); err != nil {
		t.Fatal(err)
	}
	return j
}
func awaitJob(t *testing.T, c *http.Client, url string, status model.AnalysisStatus) model.AnalysisJob {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		j := readJob(t, c, url)
		if j.Status == status {
			return j
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("job did not reach %s", status)
	return model.AnalysisJob{}
}
func startJob(t *testing.T, c *http.Client, base string, companyID, userID int64) string {
	t.Helper()
	var result model.StartAnalysisResponse
	body := fmt.Sprintf(`{"role":"cfo","demo_user_id":%d,"goal":"integration goal"}`, userID)
	if err := json.Unmarshal(requestJSON(t, c, "POST", fmt.Sprintf("%s/api/v1/companies/%d/analysis", base, companyID), body, "", 202), &result); err != nil {
		t.Fatal(err)
	}
	return result.JobID
}
func nextSSE(t *testing.T, s *bufio.Scanner) model.AnalysisJob {
	t.Helper()
	for s.Scan() {
		if line := s.Text(); strings.HasPrefix(line, "data: ") {
			var j model.AnalysisJob
			if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &j); err != nil {
				t.Fatal(err)
			}
			return j
		}
	}
	t.Fatalf("SSE ended: %v", s.Err())
	return model.AnalysisJob{}
}

func TestPostgresAnalysisIntegration(t *testing.T) {
	db := integrationDB(t)
	t.Setenv("ML_CALLBACK_TOKEN", "integration-callback-only")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// Commit fixtures before the pooled background worker accesses them.
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	var companyID, userID int64
	if err = tx.QueryRow(ctx, `INSERT INTO companies(synthetic_u,cl_type) VALUES('U_INTEGRATION','CLIENT') RETURNING id`).Scan(&companyID); err != nil {
		t.Fatal(err)
	}
	if err = tx.QueryRow(ctx, `SELECT id FROM demo_users WHERE synthetic_f='F_25503'`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO person_company_links(synthetic_f,synthetic_u) VALUES('F_25503','U_INTEGRATION')`); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	t.Run("mock API persistence SSE callbacks", func(t *testing.T) {
		mock := &gatedMock{release: make(chan struct{})}
		server := httptest.NewServer(newMux(db, mock))
		defer server.Close()
		client := &http.Client{Timeout: 8 * time.Second}
		var ids []string
		defer func() {
			mock.open()
			// Drain background writes even when an assertion fails, before closing the pool/schema.
			deadline := time.Now().Add(7 * time.Second)
			for _, id := range ids {
				for time.Now().Before(deadline) {
					var status string
					ctx, cancel := context.WithTimeout(context.Background(), time.Second)
					err := db.QueryRow(ctx, `SELECT status FROM analysis_jobs WHERE id=$1::uuid`, id).Scan(&status)
					cancel()
					if err == nil && (status == "completed" || status == "failed") {
						break
					}
					time.Sleep(10 * time.Millisecond)
				}
			}
		}()
		id := startJob(t, client, server.URL, companyID, userID)
		ids = append(ids, id)
		url := server.URL + "/api/v1/analysis/jobs/" + id
		pending := readJob(t, client, url)
		if pending.Status != model.AnalysisStatusPending || string(pending.Result) != "null" {
			t.Fatalf("unexpected pending: %+v", pending)
		}
		sseCtx, sseCancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer sseCancel()
		req, _ := http.NewRequestWithContext(sseCtx, "GET", url+"/events", nil)
		stream, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer stream.Body.Close()
		if stream.StatusCode != 200 || stream.Header.Get("Content-Type") != "text/event-stream" {
			t.Fatal("SSE unavailable")
		}
		scanner := bufio.NewScanner(stream.Body)
		if j := nextSSE(t, scanner); j.Status != model.AnalysisStatusPending {
			t.Fatalf("got %s", j.Status)
		}
		stopWorker := startWorker(t, db, mock)
		defer stopWorker()
		awaitJob(t, client, url, model.AnalysisStatusRunning)
		callbackURL := server.URL + "/api/v1/internal/analysis/events"
		event := fmt.Sprintf(`{"job_id":%q,"status":"running","stage":"analyzing"}`, id)
		requestJSON(t, client, "POST", callbackURL, event, "wrong", 401)
		requestJSON(t, client, "POST", callbackURL, event, "integration-callback-only", 204)
		if j := nextSSE(t, scanner); j.Status != model.AnalysisStatusRunning {
			t.Fatalf("got %s", j.Status)
		}
		mock.open()
		completed := awaitJob(t, client, url, model.AnalysisStatusCompleted)
		if j := nextSSE(t, scanner); j.Status != model.AnalysisStatusCompleted {
			t.Fatalf("got %s", j.Status)
		}
		sseCancel()
		stream.Body.Close()
		if completed.Stage == nil || *completed.Stage != model.AnalysisStageCompleted || completed.Goal == nil || *completed.Goal != "integration goal" || completed.CompanyID != companyID || completed.DemoUserID == nil || *completed.DemoUserID != userID {
			t.Fatalf("unexpected completed: %+v", completed)
		}
		expected, err := (mlclient.MockClient{}).Analyze(context.Background(), mlclient.AnalysisRequest{JobID: id, CompanyID: companyID, Role: "cfo", Goal: completed.Goal})
		if err != nil {
			t.Fatal(err)
		}
		var want, got, stored any
		if err = json.Unmarshal(expected, &want); err != nil {
			t.Fatal(err)
		}
		if err = json.Unmarshal(completed.Result, &got); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(want, got) {
			t.Fatalf("result differs: %s", completed.Result)
		}
		var persisted json.RawMessage
		if err = db.QueryRow(context.Background(), `SELECT result FROM analysis_jobs WHERE id=$1::uuid`, id).Scan(&persisted); err != nil {
			t.Fatal(err)
		}
		if err = json.Unmarshal(persisted, &stored); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(stored, got) {
			t.Fatal("API differs from persisted JSONB")
		}
		// Concurrent duplicate/late callbacks must preserve the terminal record, including updated_at.
		var wg sync.WaitGroup
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				body := fmt.Sprintf(`{"job_id":%q,"status":"failed","error_message":"late callback"}`, id)
				req, _ := http.NewRequest("POST", callbackURL, strings.NewReader(body))
				req.Header.Set("Authorization", "Bearer integration-callback-only")
				resp, err := client.Do(req)
				if err != nil {
					t.Error(err)
					return
				}
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				if resp.StatusCode != 204 {
					t.Errorf("callback: %d", resp.StatusCode)
				}
			}()
		}
		wg.Wait()
		if after := readJob(t, client, url); !reflect.DeepEqual(after, completed) {
			t.Fatalf("terminal job changed: %+v", after)
		}
		// Repeated POST deliberately creates a separate job: the public API has no idempotency key.
		second := startJob(t, client, server.URL, companyID, userID)
		ids = append(ids, second)
		if second == id {
			t.Fatal("duplicate job ID")
		}
		awaitJob(t, client, server.URL+"/api/v1/analysis/jobs/"+second, model.AnalysisStatusCompleted)
		var count int
		if err = db.QueryRow(context.Background(), `SELECT count(*) FROM analysis_jobs WHERE company_id=$1`, companyID).Scan(&count); err != nil || count != 2 {
			t.Fatalf("jobs: %d, %v", count, err)
		}
		var history struct {
			Jobs []model.AnalysisJobSummary `json:"jobs"`
		}
		if err = json.Unmarshal(requestJSON(t, client, "GET", fmt.Sprintf("%s/api/v1/demo/users/%d/analysis/jobs", server.URL, userID), "", "", 200), &history); err != nil {
			t.Fatal(err)
		}
		if len(history.Jobs) != 2 {
			t.Fatalf("history: %d", len(history.Jobs))
		}
		requestJSON(t, client, "POST", fmt.Sprintf("%s/api/v1/companies/%d/analysis", server.URL, companyID), `{"role":"missing"}`, "", 400)
		requestJSON(t, client, "POST", fmt.Sprintf("%s/api/v1/companies/%d/analysis", server.URL, companyID), `{"role":"cfo","demo_user_id":999999}`, "", 404)
		requestJSON(t, client, "GET", server.URL+"/api/v1/analysis/jobs/00000000-0000-4000-8000-000000000000", "", "", 404)
		requestJSON(t, client, "POST", callbackURL, `{"job_id":"00000000-0000-4000-8000-000000000000","status":"running"}`, "integration-callback-only", 404)
	})
	for _, tc := range []struct {
		name       string
		mock       failingMock
		wantResult bool
	}{
		{"unavailable", failingMock{err: errors.New("mock unavailable")}, false},
		{"timeout", failingMock{err: context.DeadlineExceeded}, false},
		{"invalid JSON", failingMock{result: json.RawMessage(`{`)}, false},
		{"unknown outcome", failingMock{result: json.RawMessage(`{"outcome":"unexpected"}`)}, false},
		{"ML failed outcome", failingMock{result: json.RawMessage(`{"outcome":"failed"}`)}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(newMux(db, tc.mock))
			defer server.Close()
			stopWorker := startWorker(t, db, tc.mock)
			defer stopWorker()
			client := &http.Client{Timeout: 5 * time.Second}
			id := startJob(t, client, server.URL, companyID, userID)
			j := awaitJob(t, client, server.URL+"/api/v1/analysis/jobs/"+id, model.AnalysisStatusFailed)
			if tc.wantResult {
				if !json.Valid(j.Result) {
					t.Fatal("failed ML result not saved")
				}
			} else if j.ErrorMessage == nil || *j.ErrorMessage == "" || string(j.Result) != "null" {
				t.Fatalf("error not persisted: %+v", j)
			}
		})
	}
	// Closing SSE and HTTP responses must return all pooled connections.
	deadline := time.Now().Add(3 * time.Second)
	for db.Stat().AcquiredConns() != 0 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if n := db.Stat().AcquiredConns(); n != 0 {
		t.Errorf("connections still acquired: %d", n)
	}

}

// Separate lifecycle from the router, exactly as main does. Tests can stop and
// replace a worker while the same PostgreSQL state remains intact.
func startWorker(t *testing.T, db *pgxpool.Pool, ml mlclient.Analyzer) func() {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	r := repo.NewAnalysisRepository(db)
	go func() { defer close(done); service.NewAnalysisService(r, ml).Run(ctx, r) }()
	stop := func() {
		cancel()
		select {
		case <-done:
		case <-time.After(10 * time.Second):
			t.Error("worker failed to stop")
		}
	}
	t.Cleanup(stop)
	return stop
}
