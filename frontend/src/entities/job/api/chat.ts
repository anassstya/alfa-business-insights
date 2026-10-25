import { apiClient } from "@/shared";

type ChatAuthor = 'user' | 'assistant';

interface ChatMessage {
  role: ChatAuthor;
  content: string;
}

interface AnalysisChatBody {
  message: string;
  /** предыдущие сообщения — чтобы ответ учитывал контекст разговора */
  history: ChatMessage[];
}

interface AnalysisChatResponse {
  reply: string;
}

/**
 * POST /api/v1/analysis/jobs/{jobID}/chat — вопрос по результатам анализа.
 * FIXME(openapi): эндпоинта нет ни в спецификации, ни на backend — контракт предварительный,
 * его нужно согласовать (в т.ч. будет ли ответ потоковым через SSE).
 */
const sendAnalysisChatMessage = async (jobId: string, body: AnalysisChatBody, signal?: AbortSignal) => {
  const { data } = await apiClient.post<AnalysisChatResponse>(
    `/api/v1/analysis/jobs/${encodeURIComponent(jobId)}/chat`,
    body,
    { signal },
  );

  return data.reply;
}

export { sendAnalysisChatMessage, type ChatAuthor, type ChatMessage, type AnalysisChatBody, type AnalysisChatResponse };
