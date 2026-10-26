import { apiClient } from "@/shared";
import type {
  ChatMessage, ChatMessagesResponse, SendChatMessageRequest, SendChatMessageResponse,
} from "../model/types";

const chatUrl = (jobId: string) => `/api/v1/analysis/jobs/${encodeURIComponent(jobId)}/chat`;

/** GET /api/v1/analysis/jobs/{jobID}/chat/messages — история сессии, от старых к новым */
const getChatMessages = async (jobId: string, signal?: AbortSignal) => {
  const { data } = await apiClient.get<ChatMessagesResponse>(`${chatUrl(jobId)}/messages`, { signal });

  return data.messages;
}

/**
 * POST /api/v1/analysis/jobs/{jobID}/chat/messages — сообщение пользователя, 201 { message_id }.
 * Пока backend только сохраняет сообщение: ответ ML не генерируется (см. описание в openapi.yaml).
 */
const sendChatMessage = async (jobId: string, content: string) => {
  const body: SendChatMessageRequest = { content };
  const { data } = await apiClient.post<SendChatMessageResponse>(`${chatUrl(jobId)}/messages`, body);

  return data.message_id;
}

interface ChatEventsParams {
  /** новое сообщение сессии (в т.ч. ответ ассистента) */
  onMessage(message: ChatMessage): void;
  /** ошибка соединения; closed: true — браузер больше не переподключается (например, сервер ответил 503) */
  onError?(event: Event, closed: boolean): void;
}

/** имена событий, в которых может прийти сообщение; `message` — событие без имени */
const CHAT_MESSAGE_EVENTS = ['message', 'chat_message'] as const;

/**
 * GET /api/v1/analysis/jobs/{jobID}/chat/events — новые сообщения сессии по SSE.
 * FIXME(openapi): ручка зарезервирована, сейчас отвечает 503, протокол событий не согласован.
 * Предполагаем, что data каждого события — JSON ChatMessage; события не по формату пропускаем.
 * Возвращает функцию отписки.
 */
const chatEvents = (jobId: string, { onMessage, onError }: ChatEventsParams) => {
  const source = new EventSource(`${import.meta.env.VITE_API_URL ?? ''}${chatUrl(jobId)}/events`);

  const handleMessage = (event: MessageEvent<string>) => {
    try {
      const message = JSON.parse(event.data) as Partial<ChatMessage>;

      if (message && typeof message.id === 'string' && typeof message.content === 'string') {
        onMessage(message as ChatMessage);
      }
    } catch {
      // не JSON (например, служебная строка) — это не сообщение чата
    }
  }

  CHAT_MESSAGE_EVENTS.forEach(name => source.addEventListener(name, handleMessage));
  source.addEventListener('error', (event) => onError?.(event, source.readyState === EventSource.CLOSED));

  return () => source.close();
}

export { getChatMessages, sendChatMessage, chatEvents };
