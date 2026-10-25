package handler

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/service"
)

var analysisUUIDPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$`,
)

type AnalysisHandler struct {
	service *service.AnalysisService
}

func NewAnalysisHandler(s *service.AnalysisService) *AnalysisHandler {
	return &AnalysisHandler{service: s}
}

func (h *AnalysisHandler) StartAnalysis(w http.ResponseWriter, r *http.Request) {
	companyID, err := strconv.ParseInt(
		r.PathValue("companyID"),
		10,
		64,
	)
	if err != nil || companyID <= 0 {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Некорректный ID компании",
		)
		return
	}

	var req model.StartAnalysisRequest

	decoder := json.NewDecoder(
		http.MaxBytesReader(w, r.Body, 1<<20),
	)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Некорректное тело запроса",
		)
		return
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Ожидался один JSON-объект",
		)
		return
	}

	jobID, err := h.service.StartAnalysis(
		r.Context(),
		companyID,
		req,
	)

	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			writeAnalysisError(
				w,
				http.StatusBadRequest,
				"Некорректные параметры",
			)

		case errors.Is(err, service.ErrInvalidRole):
			writeAnalysisError(
				w,
				http.StatusBadRequest,
				"Неизвестная роль",
			)

		case errors.Is(err, service.ErrCompanyNotFound):
			writeAnalysisError(
				w,
				http.StatusNotFound,
				"Компания не найдена или недоступна",
			)

		default:
			writeAnalysisError(
				w,
				http.StatusInternalServerError,
				"Не удалось запустить анализ",
			)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)

	_ = json.NewEncoder(w).Encode(
		model.StartAnalysisResponse{
			JobID: jobID,
		},
	)
}

func (h *AnalysisHandler) GetUserAnalysisJobs(w http.ResponseWriter, r *http.Request) {
	demoUserID, err := strconv.ParseInt(
		r.PathValue("id"),
		10,
		64,
	)
	if err != nil || demoUserID <= 0 {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Некорректный ID пользователя",
		)
		return
	}

	jobs, err := h.service.ListAnalysisJobs(
		r.Context(),
		demoUserID,
	)
	if err != nil {
		writeAnalysisError(
			w,
			http.StatusInternalServerError,
			"Не удалось получить историю анализов",
		)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]any{
		"jobs": jobs,
	})
}

func (h *AnalysisHandler) GetAnalysisJob(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("jobID")

	if !analysisUUIDPattern.MatchString(jobID) {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Некорректный job_id",
		)
		return
	}

	job, err := h.service.GetAnalysisJob(
		r.Context(),
		jobID,
	)

	if err != nil {
		if errors.Is(err, service.ErrAnalysisNotFound) {
			writeAnalysisError(
				w,
				http.StatusNotFound,
				"Анализ не найден",
			)
			return
		}

		writeAnalysisError(
			w,
			http.StatusInternalServerError,
			"Не удалось получить анализ",
		)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(job)
}

func (h *AnalysisHandler) StreamAnalysisEvents(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("jobID")

	if !analysisUUIDPattern.MatchString(jobID) {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Некорректный job_id",
		)
		return
	}

	job, err := h.service.GetAnalysisJob(
		r.Context(),
		jobID,
	)
	if err != nil {
		if errors.Is(err, service.ErrAnalysisNotFound) {
			writeAnalysisError(
				w,
				http.StatusNotFound,
				"Анализ не найден",
			)
			return
		}

		writeAnalysisError(
			w,
			http.StatusInternalServerError,
			"Не удалось получить анализ",
		)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeAnalysisError(
			w,
			http.StatusInternalServerError,
			"SSE не поддерживается",
		)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	lastData, err := json.Marshal(job)
	if err != nil {
		return
	}

	if _, err := fmt.Fprintf(
		w,
		"event: update\ndata: %s\n\n",
		lastData,
	); err != nil {
		return
	}

	flusher.Flush()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return

		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}

			flusher.Flush()

		case <-ticker.C:
			job, err := h.service.GetAnalysisJob(
				r.Context(),
				jobID,
			)
			if err != nil {
				return
			}

			data, err := json.Marshal(job)
			if err != nil {
				return
			}

			if string(data) == string(lastData) {
				continue
			}

			lastData = data

			if _, err := fmt.Fprintf(
				w,
				"event: update\ndata: %s\n\n",
				data,
			); err != nil {
				return
			}

			flusher.Flush()
		}
	}
}

type analysisEventRequest struct {
	JobID        string               `json:"job_id"`
	Status       model.AnalysisStatus `json:"status"`
	Stage        *model.AnalysisStage `json:"stage"`
	Result       json.RawMessage      `json:"result"`
	ErrorMessage *string              `json:"error_message"`
}

func (h *AnalysisHandler) ReceiveAnalysisEvent(w http.ResponseWriter, r *http.Request) {
	token := os.Getenv("ML_CALLBACK_TOKEN")

	if token == "" {
		writeAnalysisError(
			w,
			http.StatusServiceUnavailable,
			"ML callback не настроен",
		)
		return
	}

	auth := r.Header.Get("Authorization")
	expected := "Bearer " + token

	if subtle.ConstantTimeCompare(
		[]byte(auth),
		[]byte(expected),
	) != 1 {
		writeAnalysisError(
			w,
			http.StatusUnauthorized,
			"Не авторизован",
		)
		return
	}

	var req analysisEventRequest

	decoder := json.NewDecoder(
		http.MaxBytesReader(w, r.Body, 1<<20),
	)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Некорректное тело запроса",
		)
		return
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Ожидался один JSON-объект",
		)
		return
	}

	if !analysisUUIDPattern.MatchString(req.JobID) ||
		strings.TrimSpace(string(req.Status)) == "" {
		writeAnalysisError(
			w,
			http.StatusBadRequest,
			"Некорректные параметры события",
		)
		return
	}

	err := h.service.UpdateAnalysisFromEvent(
		r.Context(),
		req.JobID,
		req.Status,
		req.Stage,
		req.Result,
		req.ErrorMessage,
	)

	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			writeAnalysisError(
				w,
				http.StatusBadRequest,
				"Некорректные параметры события",
			)

		case errors.Is(err, service.ErrAnalysisNotFound):
			writeAnalysisError(
				w,
				http.StatusNotFound,
				"Анализ не найден",
			)

		default:
			writeAnalysisError(
				w,
				http.StatusInternalServerError,
				"Не удалось обновить анализ",
			)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func writeAnalysisError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
