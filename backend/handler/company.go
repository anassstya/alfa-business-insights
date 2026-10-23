package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
)

type CompanyHandler struct {
	repo *repo.CompanyRepository
}

func NewCompanyHandler(r *repo.CompanyRepository) *CompanyHandler {
	return &CompanyHandler{repo: r}
}

func (h *CompanyHandler) GetByDemoUserID(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	companies, userExists, err := h.repo.GetByDemoUserID(r.Context(), userID)
	if err != nil {
		log.Printf("Failed to get companies: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if !userExists {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	response := struct {
		Companies []model.Company `json:"companies"`
	}{
		Companies: companies,
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode companies: %v", err)
	}
}

func (h *CompanyHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	limit := 20
	offset := 0

	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > 100 {
			http.Error(w, "Invalid limit", http.StatusBadRequest)
			return
		}
		limit = parsed
	}

	if value := r.URL.Query().Get("offset"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 {
			http.Error(w, "Invalid offset", http.StatusBadRequest)
			return
		}
		offset = parsed
	}

	companies, total, err := h.repo.GetAll(r.Context(), limit, offset)
	if err != nil {
		log.Printf("Failed to get companies: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	response := struct {
		Companies []model.Company `json:"companies"`
		Total     int64           `json:"total"`
		Limit     int             `json:"limit"`
		Offset    int             `json:"offset"`
	}{
		Companies: companies,
		Total:     total,
		Limit:     limit,
		Offset:    offset,
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode companies: %v", err)
	}
}
