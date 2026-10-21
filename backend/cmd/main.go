package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"alfa-business-insights/backend/handler"
	"alfa-business-insights/backend/repo"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(ctx); err != nil {
		log.Fatal(err)
	}

	roleRepo := repo.NewRoleRepository(db)
	roleHandler := handler.NewRoleHandler(roleRepo)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/roles", roleHandler.GetRoles)

	server := &http.Server{
		Addr:              ":8080",
		Handler:           cors(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Println("Server started on port 8080")
	log.Fatal(server.ListenAndServe())
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin == "http://localhost:8081" ||
			origin == "http://localhost:3000" ||
			origin == "http://localhost:5173" {

			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		if r.Method == http.MethodOptions {
			if origin != "" &&
				origin != "http://localhost:8081" &&
				origin != "http://localhost:3000" &&
				origin != "http://localhost:5173" {
				w.WriteHeader(http.StatusForbidden)
				return
			}

			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
