package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"alfa-business-insights/backend/model"
	"alfa-business-insights/backend/repo"
	"alfa-business-insights/backend/service"
)

type ChatHandler struct {
	service *service.ChatService
}

func NewChatHandler(s *service.ChatService) *ChatHandler {
	return &ChatHandler{service: s}
}

func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("jobID")

	messages, err := h.service.GetMessages(r.Context(), jobID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrChatInvalidInput):
			writeChatError(w, http.StatusBadRequest, "Некорректный job_id")

		case errors.Is(err, service.ErrChatJobNotFound):
			writeChatError(w, http.StatusNotFound, "Аналитическая сессия не найдена")

		default:
			writeChatError(w, http.StatusInternalServerError, "Не удалось получить сообщения")
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(model.ChatMessagesResponse{
		Messages: messages,
	})
}

func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("jobID")

	var req model.SendChatMessageRequest

	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		writeChatError(w, http.StatusBadRequest, "Некорректное тело запроса")
		return
	}

	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		writeChatError(w, http.StatusBadRequest, "Ожидался один JSON-объект")
		return
	}

	messageID, err := h.service.SaveUserMessage(
		r.Context(),
		jobID,
		req.Content,
	)

	if err != nil {
		switch {
		case errors.Is(err, service.ErrChatInvalidInput):
			writeChatError(w, http.StatusBadRequest, "Некорректные параметры сообщения")

		case errors.Is(err, service.ErrChatJobNotFound):
			writeChatError(w, http.StatusNotFound, "Аналитическая сессия не найдена")

		case errors.Is(err, service.ErrChatNotReady):
			writeChatError(w, http.StatusConflict, "Анализ ещё не завершён или завершился ошибкой")
		case errors.Is(err, repo.ErrChatBusy):
			writeChatError(w, http.StatusConflict, "Дождитесь ответа на предыдущее сообщение")
		case errors.Is(err, service.ErrChatUnavailable):
			writeChatError(w, http.StatusServiceUnavailable, "ML-чат не настроен")
		case errors.Is(err, context.DeadlineExceeded):
			writeChatError(w, http.StatusGatewayTimeout, "Превышено время обработки сообщения")
		case errors.Is(err, service.ErrChatML):
			writeChatError(w, http.StatusBadGateway, "Не удалось получить корректный ответ ML")
		default:
			writeChatError(w, http.StatusInternalServerError, "Не удалось сохранить сообщение")
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	_ = json.NewEncoder(w).Encode(model.SendChatMessageResponse{
		MessageID: messageID,
	})
}

func (h *ChatHandler) StreamChatEvents(w http.ResponseWriter, r *http.Request) {
	writeChatError(
		w,
		http.StatusServiceUnavailable,
		"Стриминг чата не используется; ответ доступен через GET истории после POST",
	)
}

func writeChatError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
