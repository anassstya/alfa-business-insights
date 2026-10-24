package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"alfa-business-insights/backend/handler"
	"alfa-business-insights/backend/repo"
	"alfa-business-insights/backend/service"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Failed to create database pool: %v", err)
	}
	defer db.Close()

	if err := db.Ping(ctx); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to PostgreSQL successfully")

	roleRepo := repo.NewRoleRepository(db)
	roleHandler := handler.NewRoleHandler(roleRepo)

	demoUserRepo := repo.NewDemoUserRepository(db)
	demoUserHandler := handler.NewDemoUserHandler(demoUserRepo)

	companyRepo := repo.NewCompanyRepository(db)
	companyHandler := handler.NewCompanyHandler(companyRepo)

	analysisRepo := repo.NewAnalysisRepository(db)
	analysisService := service.NewAnalysisService(analysisRepo)
	analysisHandler := handler.NewAnalysisHandler(analysisService)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/roles", roleHandler.GetRoles)
	mux.HandleFunc("GET /api/v1/demo/users", demoUserHandler.GetUsers)
	mux.HandleFunc("GET /api/v1/demo/users/{id}/companies", companyHandler.GetByDemoUserID)
	mux.HandleFunc("GET /api/v1/companies", companyHandler.GetAll)
	mux.HandleFunc("POST /api/v1/companies/{companyID}/analysis", analysisHandler.StartAnalysis)
	mux.HandleFunc("GET /api/v1/companies/{companyID}", companyHandler.GetByID)
	
	server := &http.Server{
		Addr:              ":8080",
		Handler:           cors(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Println("Server started on port 8080")
	log.Fatal(server.ListenAndServe())
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
