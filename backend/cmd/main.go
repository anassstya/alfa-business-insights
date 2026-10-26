package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"alfa-business-insights/backend/handler"
	"alfa-business-insights/backend/mlclient"
	"alfa-business-insights/backend/repo"
	"alfa-business-insights/backend/service"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is not set")
	}

	mlClient, err := mlclient.FromEnvironment(os.Getenv)
	if err != nil {
		return fmt.Errorf("invalid ML configuration: %w", err)
	}
	if os.Getenv("ML_MODE") != "mock" && os.Getenv("ML_CALLBACK_TOKEN") == "" {
		return errors.New("ML_CALLBACK_TOKEN is not set")
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		15*time.Second,
	)
	defer cancel()

	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("create database pool: %w", err)
	}
	defer db.Close()

	if err := db.Ping(ctx); err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}

	log.Println("Connected to PostgreSQL successfully")

	workerCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	workerRepo := repo.NewAnalysisRepository(db)
	worker := service.NewAnalysisService(workerRepo, mlClient)
	workerDone := make(chan struct{})
	go func() { defer close(workerDone); worker.Run(workerCtx, workerRepo) }()
	defer func() { stop(); <-workerDone }()

	server := &http.Server{
		Addr:              ":8080",
		Handler:           cors(newMux(db, mlClient)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Println("Server started on port 8080")

	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-workerCtx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP shutdown: %v", err)
			server.Close()
		}
	}()
	serveErr := server.ListenAndServe()
	stop()
	<-shutdownDone
	if errors.Is(serveErr, http.ErrServerClosed) {
		return nil
	}
	return serveErr
}

func cors(next http.Handler) http.Handler {
	allowedOrigins := map[string]bool{
		"http://localhost:8081": true,
		"http://localhost:3000": true,
		"http://localhost:5173": true,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin != "" && allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		if r.Method == http.MethodOptions {
			if origin != "" && !allowedOrigins[origin] {
				w.WriteHeader(http.StatusForbidden)
				return
			}

			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// newMux wires the same production routes for the server and integration tests.
func newMux(db *pgxpool.Pool, mlClient mlclient.Analyzer) http.Handler {
	roleRepo := repo.NewRoleRepository(db)
	roleHandler := handler.NewRoleHandler(roleRepo)

	demoUserRepo := repo.NewDemoUserRepository(db)
	demoUserHandler := handler.NewDemoUserHandler(demoUserRepo)

	companyRepo := repo.NewCompanyRepository(db)
	companyHandler := handler.NewCompanyHandler(companyRepo)

	analysisRepo := repo.NewAnalysisRepository(db)
	analysisService := service.NewAnalysisService(
		analysisRepo,
		mlClient,
	)
	analysisHandler := handler.NewAnalysisHandler(analysisService)

	// Analysis-only test doubles need not implement chat; configured HTTP and
	// Mock clients implement both interfaces.
	chatClient, _ := mlClient.(mlclient.Chatter)
	chatRepo := repo.NewChatRepository(db)
	chatService := service.NewChatService(
		chatRepo,
		analysisRepo,
		chatClient,
	)
	chatHandler := handler.NewChatHandler(chatService)

	mux := http.NewServeMux()

	mux.HandleFunc(
		"GET /api/v1/roles",
		roleHandler.GetRoles,
	)

	mux.HandleFunc(
		"GET /api/v1/demo/users",
		demoUserHandler.GetUsers,
	)

	mux.HandleFunc(
		"GET /api/v1/demo/users/{id}/companies",
		companyHandler.GetByDemoUserID,
	)

	mux.HandleFunc(
		"GET /api/v1/companies",
		companyHandler.GetAll,
	)

	mux.HandleFunc(
		"GET /api/v1/companies/{companyID}",
		companyHandler.GetByID,
	)

	mux.HandleFunc(
		"POST /api/v1/companies/{companyID}/analysis",
		analysisHandler.StartAnalysis,
	)

	mux.HandleFunc(
		"GET /api/v1/demo/users/{id}/analysis/jobs",
		analysisHandler.GetUserAnalysisJobs,
	)

	mux.HandleFunc(
		"GET /api/v1/analysis/jobs/{jobID}",
		analysisHandler.GetAnalysisJob,
	)

	mux.HandleFunc(
		"GET /api/v1/analysis/jobs/{jobID}/events",
		analysisHandler.StreamAnalysisEvents,
	)

	mux.HandleFunc(
		"POST /api/v1/internal/analysis/events",
		analysisHandler.ReceiveAnalysisEvent,
	)

	mux.HandleFunc(
		"GET /api/v1/analysis/jobs/{jobID}/chat/messages",
		chatHandler.GetMessages,
	)

	mux.HandleFunc(
		"POST /api/v1/analysis/jobs/{jobID}/chat/messages",
		chatHandler.SendMessage,
	)

	mux.HandleFunc(
		"GET /api/v1/analysis/jobs/{jobID}/chat/events",
		chatHandler.StreamChatEvents,
	)

	return mux
}
