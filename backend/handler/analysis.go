package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/service"
)

type AnalysisHandler struct {
	service *service.AnalysisService
}

func NewAnalysisHandler(s *service.AnalysisService) *AnalysisHandler {
	return &AnalysisHandler{service: s}
}

func (h *AnalysisHandler) StartAnalysis(w http.ResponseWriter, r *http.Request) {
	companyID, err := strconv.ParseInt(r.PathValue("companyID"), 10, 64)
	if err != nil || companyID <= 0 {
		writeAnalysisError(w, http.StatusBadRequest, "Некорректный ID компании")
		return
	}

	var req model.StartAnalysisRequest

	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		writeAnalysisError(w, http.StatusBadRequest, "Некорректное тело запроса")
		return
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		writeAnalysisError(w, http.StatusBadRequest, "Ожидался один JSON-объект")
		return
	}

	_, err = h.service.PrepareAnalysis(r.Context(), companyID, req)

	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			writeAnalysisError(w, http.StatusBadRequest, "Некорректные параметры")

		case errors.Is(err, service.ErrInvalidRole):
			writeAnalysisError(w, http.StatusBadRequest, "Неизвестная роль")

		case errors.Is(err, service.ErrCompanyNotFound):
			writeAnalysisError(w, http.StatusNotFound, "Компания не найдена или недоступна")

		default:
			writeAnalysisError(w, http.StatusInternalServerError, "Внутренняя ошибка сервера")
		}
		return
	}

	// TODO: Передать задачу ML-агенту и получить job_id.
	writeAnalysisError(w, http.StatusServiceUnavailable, "Запуск ML-анализа пока не подключён")
}

func writeAnalysisError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
