package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
	"alfa-business-insights/backend/service"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type countingMock struct{ calls atomic.Int32 }

func (m *countingMock) Analyze(ctx context.Context, r mlclient.AnalysisRequest) (json.RawMessage, error) {
	m.calls.Add(1)
	return (mlclient.MockClient{}).Analyze(ctx, r)
}
func recoveryJob(t *testing.T, db *pgxpool.Pool) model.AnalysisJob {
	t.Helper()
	var company int64
	if err := db.QueryRow(context.Background(), `INSERT INTO companies(synthetic_u,cl_type) VALUES('U_RECOVERY','CLIENT') RETURNING id`).Scan(&company); err != nil {
		t.Fatal(err)
	}
	var id string
	if err := db.QueryRow(context.Background(), `INSERT INTO analysis_jobs(id,company_id,role) VALUES(gen_random_uuid(),$1,'cfo') RETURNING id::text`, company).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return model.AnalysisJob{ID: id, CompanyID: company, Role: "cfo", Status: model.AnalysisStatusPending}
}
func persistedJob(t *testing.T, r *repo.AnalysisRepository, id string) model.AnalysisJob {
	t.Helper()
	j, err := r.GetByID(context.Background(), id)
	if err != nil || j == nil {
		t.Fatalf("read job: %v", err)
	}
	return *j
}
func assertNoRecoveryReplay(t *testing.T, r *repo.AnalysisRepository) {
	t.Helper()
	if err := r.ExpireAnalyses(context.Background()); err != nil {
		t.Fatal(err)
	}
	job, err := r.ClaimNextAnalysis(context.Background())
	if err != nil || job != nil {
		t.Fatalf("unexpected replay: %+v %v", job, err)
	}
}

// Invoked only in a subprocess to model a hard crash after the durable claim,
// before a response or final write. It never calls a real ML service.
type crashMock struct{}

func (crashMock) Analyze(context.Context, mlclient.AnalysisRequest) (json.RawMessage, error) {
	os.Exit(23)
	return nil, nil
}
func TestAnalysisWorkerCrashHelper(t *testing.T) {
	schema := os.Getenv("ANALYSIS_CRASH_SCHEMA")
	if schema == "" {
		t.Skip("subprocess helper")
	}
	if os.Getenv("RUN_POSTGRES_INTEGRATION") != "1" || !strings.HasPrefix(schema, "integration_") {
		t.Fatal("invalid crash test configuration")
	}
	cfg, err := pgxpool.ParseConfig(os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "alfa_insights_test" || cfg.ConnConfig.User != "alfa_test" || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("require dedicated local test DB")
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := repo.NewAnalysisRepository(db)
	service.NewAnalysisService(r, crashMock{}).Run(ctx, r)
	t.Fatal("worker did not claim the crash fixture")
}

func TestPostgresRecoveryIntegration(t *testing.T) {
	db := integrationDB(t)
	r := repo.NewAnalysisRepository(db)
	t.Setenv("ML_CALLBACK_TOKEN", "integration-callback-only")
	client := &http.Client{Timeout: 5 * time.Second}

	t.Run("restart recovers durable pending", func(t *testing.T) {
		// Old instance accepts the POST while no worker is running, then closes.
		var company, user int64
		if err := db.QueryRow(context.Background(), `INSERT INTO companies(synthetic_u,cl_type) VALUES('U_RESTART','CLIENT') RETURNING id`).Scan(&company); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(context.Background(), `SELECT id FROM demo_users WHERE synthetic_f='F_25503'`).Scan(&user); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(context.Background(), `INSERT INTO person_company_links(synthetic_f,synthetic_u) VALUES('F_25503','U_RESTART')`); err != nil {
			t.Fatal(err)
		}
		old := httptest.NewServer(newMux(db, mlclient.MockClient{}))
		id := startJob(t, client, old.URL, company, user)
		old.Close()
		if j := persistedJob(t, r, id); j.Status != model.AnalysisStatusPending {
			t.Fatalf("got %s", j.Status)
		}
		// New instance uses a new connection pool against the same durable schema.
		nextDB, err := pgxpool.NewWithConfig(context.Background(), db.Config())
		if err != nil {
			t.Fatal(err)
		}
		defer nextDB.Close()
		ml := &countingMock{}
		next := httptest.NewServer(newMux(nextDB, ml))
		defer next.Close()
		stop := startWorker(t, nextDB, ml)
		defer stop()
		awaitJob(t, client, next.URL+"/api/v1/analysis/jobs/"+id, model.AnalysisStatusCompleted)
		stop()
		if ml.calls.Load() != 1 {
			t.Fatalf("calls: %d", ml.calls.Load())
		}
		assertNoRecoveryReplay(t, r)
	})

	t.Run("hard crash running is not replayed and expires", func(t *testing.T) {
		job := recoveryJob(t, db)
		binary, err := os.Executable()
		if err != nil {
			t.Fatal(err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, binary, "-test.run=^TestAnalysisWorkerCrashHelper$", "-test.timeout=9s")
		cmd.Env = append(os.Environ(), "ANALYSIS_CRASH_SCHEMA="+db.Config().ConnConfig.RuntimeParams["search_path"])
		output, err := cmd.CombinedOutput()
		var exit *exec.ExitError
		if !errors.As(err, &exit) || exit.ExitCode() != 23 {
			t.Fatalf("expected hard crash 23, got %v: %s", err, output)
		}
		before := persistedJob(t, r, job.ID)
		if before.Status != model.AnalysisStatusRunning {
			t.Fatalf("got %s", before.Status)
		}
		// Restart must neither reclaim it nor declare it dead while its deadline is live.
		assertNoRecoveryReplay(t, r)
		if after := persistedJob(t, r, job.ID); !reflect.DeepEqual(before, after) {
			t.Fatal("active running job changed on recovery")
		}
		// Advance only this fixture's fixed deadline, without changing production timeouts.
		if _, err := db.Exec(context.Background(), `UPDATE analysis_jobs SET recovery_deadline=clock_timestamp()-INTERVAL '1 second' WHERE id=$1::uuid`, job.ID); err != nil {
			t.Fatal(err)
		}
		server := httptest.NewServer(newMux(db, mlclient.MockClient{}))
		defer server.Close()
		// A late heartbeat must not extend an already elapsed fixed deadline.
		progress := fmt.Sprintf(`{"job_id":%q,"status":"running","stage":"analyzing"}`, job.ID)
		requestJSON(t, client, "POST", server.URL+"/api/v1/internal/analysis/events", progress, "integration-callback-only", 204)
		ml := &countingMock{}
		stop := startWorker(t, db, ml)
		defer stop()
		url := server.URL + "/api/v1/analysis/jobs/" + job.ID
		failed := awaitJob(t, client, url, model.AnalysisStatusFailed)
		stop()
		if ml.calls.Load() != 0 || failed.ErrorMessage == nil || !strings.Contains(*failed.ErrorMessage, "backend_recovery_timeout") {
			t.Fatalf("unsafe recovery: calls=%d job=%+v", ml.calls.Load(), failed)
		}
		// Repeated recovery and a late successful ML callback cannot resurrect the task.
		assertNoRecoveryReplay(t, r)
		body := fmt.Sprintf(`{"job_id":%q,"status":"completed","stage":"completed","result":{"outcome":"ok"}}`, job.ID)
		requestJSON(t, client, "POST", server.URL+"/api/v1/internal/analysis/events", body, "integration-callback-only", 204)
		if after := readJob(t, client, url); !reflect.DeepEqual(after, failed) {
			t.Fatal("late callback overwrote recovered failure")
		}
	})

	t.Run("graceful restart preserves late callback window", func(t *testing.T) {
		job := recoveryJob(t, db)
		gate := &gatedMock{release: make(chan struct{})}
		server := httptest.NewServer(newMux(db, gate))
		defer server.Close()
		stop := startWorker(t, db, gate)
		defer stop()
		url := server.URL + "/api/v1/analysis/jobs/" + job.ID
		awaitJob(t, client, url, model.AnalysisStatusRunning)
		stop()
		if got := readJob(t, client, url); got.Status != model.AnalysisStatusRunning {
			t.Fatalf("shutdown closed callback window: %+v", got)
		}
		// A replacement instance must leave this task alone while awaiting callback.
		ml := &countingMock{}
		nextStop := startWorker(t, db, ml)
		defer nextStop()
		body := fmt.Sprintf(`{"job_id":%q,"status":"completed","stage":"completed","result":{"outcome":"ok"}}`, job.ID)
		requestJSON(t, client, "POST", server.URL+"/api/v1/internal/analysis/events", body, "integration-callback-only", 204)
		awaitJob(t, client, url, model.AnalysisStatusCompleted)
		nextStop()
		if ml.calls.Load() != 0 {
			t.Fatal("replacement worker repeated ML")
		}
		assertNoRecoveryReplay(t, r)
	})

	t.Run("multiple handlers claim once", func(t *testing.T) {
		const total = 12
		jobs := make([]model.AnalysisJob, total)
		for i := range jobs {
			jobs[i] = recoveryJob(t, db)
		}
		ml := &countingMock{}
		stopA := startWorker(t, db, ml)
		defer stopA()
		otherDB, err := pgxpool.NewWithConfig(context.Background(), db.Config())
		if err != nil {
			t.Fatal(err)
		}
		defer otherDB.Close()
		stopB := startWorker(t, otherDB, ml)
		defer stopB()
		deadline := time.Now().Add(5 * time.Second)
		for _, job := range jobs {
			for {
				got := persistedJob(t, r, job.ID)
				if got.Status == model.AnalysisStatusCompleted {
					break
				}
				if time.Now().After(deadline) {
					t.Fatalf("unfinished: %+v", got)
				}
				time.Sleep(10 * time.Millisecond)
			}
		}
		stopA()
		stopB()
		if ml.calls.Load() != total {
			t.Fatalf("ML calls: %d, want %d", ml.calls.Load(), total)
		}
		assertNoRecoveryReplay(t, r)
	})

	t.Run("row lock prevents double dispatch and SQL failure is recoverable", func(t *testing.T) {
		job := recoveryJob(t, db)
		tx, err := db.Begin(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(context.Background())
		if _, err = tx.Exec(context.Background(), `SELECT id FROM analysis_jobs WHERE id=$1::uuid FOR UPDATE`, job.ID); err != nil {
			t.Fatal(err)
		}
		claimed, err := r.ClaimNextAnalysis(context.Background())
		if err != nil || claimed != nil {
			t.Fatalf("locked job claimed: %+v %v", claimed, err)
		}
		// Simulate an interrupted SQL operation safely, without stopping a shared DB.
		cancelled, cancel := context.WithCancel(context.Background())
		cancel()
		if _, err = r.ClaimNextAnalysis(cancelled); err == nil {
			t.Fatal("cancelled DB operation succeeded")
		}
		if err = r.ExpireAnalyses(cancelled); err == nil {
			t.Fatal("cancelled recovery succeeded")
		}
		if err = tx.Rollback(context.Background()); err != nil {
			t.Fatal(err)
		}
		claimed, err = r.ClaimNextAnalysis(context.Background())
		if err != nil || claimed == nil || claimed.ID != job.ID {
			t.Fatalf("claim after failure: %+v %v", claimed, err)
		}
		// Block a final write on a real row lock and let its DB deadline expire.
		tx, err = db.Begin(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(context.Background())
		if _, err = tx.Exec(context.Background(), `SELECT id FROM analysis_jobs WHERE id=$1::uuid FOR UPDATE`, job.ID); err != nil {
			t.Fatal(err)
		}
		blockedCfg := db.Config()
		blockedCfg.ConnConfig.RuntimeParams["statement_timeout"] = "30ms"
		blockedDB, err := pgxpool.NewWithConfig(context.Background(), blockedCfg)
		if err != nil {
			t.Fatal(err)
		}
		defer blockedDB.Close()
		_, err = repo.NewAnalysisRepository(blockedDB).UpdateFromEvent(context.Background(), job.ID, model.AnalysisStatusCompleted, nil, json.RawMessage(`{"outcome":"ok"}`), nil)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "57014" {
			t.Fatalf("expected PostgreSQL statement timeout, got %v", err)
		}
		if err = tx.Rollback(context.Background()); err != nil {
			t.Fatal(err)
		}
		if got := persistedJob(t, r, job.ID); got.Status != model.AnalysisStatusRunning {
			t.Fatal("failed SQL partially finalized job")
		}
		if _, err = db.Exec(context.Background(), `UPDATE analysis_jobs SET recovery_deadline=clock_timestamp()-INTERVAL '1 second' WHERE id=$1::uuid`, job.ID); err != nil {
			t.Fatal(err)
		}
		assertNoRecoveryReplay(t, r)
		if got := persistedJob(t, r, job.ID); got.Status != model.AnalysisStatusFailed {
			t.Fatal("failed write left job stuck")
		}
	})

	t.Run("callback and recovery race keep first terminal result", func(t *testing.T) {
		job := recoveryJob(t, db)
		if _, err := r.ClaimNextAnalysis(context.Background()); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(context.Background(), `UPDATE analysis_jobs SET recovery_deadline=clock_timestamp()-INTERVAL '1 second' WHERE id=$1::uuid`, job.ID); err != nil {
			t.Fatal(err)
		}
		var wg sync.WaitGroup
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				if i%2 == 0 {
					if err := r.ExpireAnalyses(context.Background()); err != nil {
						t.Error(err)
					}
				} else {
					if _, err := r.UpdateFromEvent(context.Background(), job.ID, model.AnalysisStatusCompleted, nil, json.RawMessage(`{"outcome":"ok"}`), nil); err != nil {
						t.Error(err)
					}
				}
			}(i)
		}
		wg.Wait()
		final := persistedJob(t, r, job.ID)
		if final.Status != model.AnalysisStatusCompleted && final.Status != model.AnalysisStatusFailed {
			t.Fatalf("got %+v", final)
		}
		if final.Status == model.AnalysisStatusCompleted {
			var response struct {
				Outcome string `json:"outcome"`
			}
			if err := json.Unmarshal(final.Result, &response); err != nil || response.Outcome != "ok" {
				t.Fatalf("unexpected result: %s", final.Result)
			}
		}
		if final.Status == model.AnalysisStatusFailed && final.ErrorMessage == nil {
			t.Fatal("recovery has no diagnostic")
		}
		assertNoRecoveryReplay(t, r)
		if _, err := r.UpdateFromEvent(context.Background(), job.ID, model.AnalysisStatusFailed, nil, nil, nil); err != nil {
			t.Fatal(err)
		}
		if after := persistedJob(t, r, job.ID); !reflect.DeepEqual(final, after) {
			t.Fatal("terminal record changed")
		}
	})
}

func TestPostgresLegacyRecoveryMigration(t *testing.T) {
	db := integrationDBWithRecovery(t, false)
	pending := recoveryJob(t, db)
	running := recoveryJob(t, db)
	completed := recoveryJob(t, db)
	if _, err := db.Exec(context.Background(), `UPDATE analysis_jobs SET status='running' WHERE id=$1::uuid`, running.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `UPDATE analysis_jobs SET status='completed', result='{"outcome":"ok"}'::jsonb WHERE id=$1::uuid`, completed.ID); err != nil {
		t.Fatal(err)
	}
	r := repo.NewAnalysisRepository(db)
	before := persistedJob(t, r, completed.ID)
	sql, err := os.ReadFile(filepath.Join("..", "..", "database", "migrations", "007_analysis_recovery.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(context.Background(), string(sql)); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{pending.ID, running.ID} {
		got := persistedJob(t, r, id)
		if got.Status != model.AnalysisStatusFailed || got.ErrorMessage == nil || !strings.Contains(*got.ErrorMessage, "backend_recovery_legacy_unknown") {
			t.Fatalf("unsafe legacy recovery: %+v", got)
		}
	}
	if after := persistedJob(t, r, completed.ID); !reflect.DeepEqual(before, after) {
		t.Fatal("migration changed completed job")
	}
	assertNoRecoveryReplay(t, r)
}
