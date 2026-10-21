package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
)

type DemoUserHandler struct {
	repo *repo.DemoUserRepository
}

func NewDemoUserHandler(r *repo.DemoUserRepository) *DemoUserHandler {
	return &DemoUserHandler{repo: r}
}

func (h *DemoUserHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.GetAll(r.Context())
	if err != nil {
		log.Printf("Failed to get demo users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := struct {
		Users []model.DemoUser `json:"users"`
	}{
		Users: users,
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode demo users: %v", err)
	}
}
