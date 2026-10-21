package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
)

type RoleHandler struct {
	repo *repo.RoleRepository
}

func NewRoleHandler(repo *repo.RoleRepository) *RoleHandler {
	return &RoleHandler{repo: repo}
}

func (h *RoleHandler) GetRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.repo.GetAll(r.Context())
	if err != nil {
		log.Printf("get roles: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := struct {
		Roles []model.Role `json:"roles"`
	}{
		Roles: roles,
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("encode roles: %v", err)
	}
}
