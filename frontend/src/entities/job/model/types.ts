/**
 * FIXME(openapi): формат результата анализа (data события `completed` в SSE) не описан ни в спецификации,
 * ни в ML. Тип предварительный — все списки на фронте читаются через `?? []`, чтобы отсутствующие
 * блоки не роняли страницу. Согласовать с backend/ML и заменить.
 */

type Level = 'high' | 'medium' | 'low';
type Sentiment = 'positive' | 'neutral' | 'negative';
type Trend = 'up' | 'down' | 'flat';

interface AnalysisMetric {
  label: string;
  /** уже отформатированное значение: «1,3 млрд ₽», «+12%» */
  value: string;
  /** изменение за период: «+4,2% за квартал» */
  delta?: string | null;
  trend?: Trend | null;
}

interface AnalysisSource {
  title: string;
  url: string;
  /** издание: «РБК», «Интерфакс» */
  source?: string | null;
  /** ISO 8601 */
  published_at?: string | null;
}

interface AnalysisInsight {
  id: string;
  title: string;
  text: string;
  importance: Level;
  tags?: string[];
  source?: AnalysisSource | null;
}

interface AnalysisRisk {
  title: string;
  text: string;
  level: Level;
}

interface AnalysisOpportunity {
  title: string;
  text: string;
}

interface AnalysisRecommendation {
  title: string;
  text: string;
  priority: Level;
}

interface AnalysisResult {
  job_id: string;
  company_id: number;
  role: string;
  goal?: string | null;
  /** ISO 8601 */
  created_at?: string | null;
  summary: {
    title: string;
    text: string;
    sentiment?: Sentiment | null;
  };
  metrics?: AnalysisMetric[];
  insights?: AnalysisInsight[];
  risks?: AnalysisRisk[];
  opportunities?: AnalysisOpportunity[];
  recommendations?: AnalysisRecommendation[];
  sources?: AnalysisSource[];
}

/** data события `progress` (предварительно) */
interface AnalysisProgress {
  stage?: string;
  /** 0..100 */
  progress?: number;
  message?: string;
}

/** data события `failed` (предварительно) */
interface AnalysisFail {
  error?: string;
}

/**
 * Статус задачи анализа. FIXME(openapi): в спецификации это просто string —
 * backend создаёт задачу со статусом `pending`, дальше статусы выставляет ML.
 */
type AnalysisJobStatus = string;

/** Элемент `jobs[]` в GET /api/v1/demo/users/{id}/analysis/jobs (AnalysisJobSummary) */
interface AnalysisJobSummary {
  job_id: string;
  company_id: number;
  role: string;
  goal?: string | null;
  status: AnalysisJobStatus;
  stage?: string | null;
  /** ISO 8601 */
  created_at: string;
}

/** Ответ GET /api/v1/demo/users/{id}/analysis/jobs — задачи от новых к старым */
interface AnalysisJobsResponse {
  jobs: AnalysisJobSummary[];
}

type ChatAuthor = 'user' | 'assistant';

/** ChatMessage из openapi.yaml — сообщение чата аналитической сессии */
interface ChatMessage {
  id: string;
  role: ChatAuthor;
  content: string;
  /** ISO 8601 */
  created_at: string;
}

/** Ответ GET /api/v1/analysis/jobs/{jobID}/chat/messages */
interface ChatMessagesResponse {
  messages: ChatMessage[];
}

/** Тело POST /api/v1/analysis/jobs/{jobID}/chat/messages */
interface SendChatMessageRequest {
  /** непустое после trim */
  content: string;
}

/** Ответ 201 POST /api/v1/analysis/jobs/{jobID}/chat/messages */
interface SendChatMessageResponse {
  message_id: string;
}

export type {
  Level, Sentiment, Trend, AnalysisMetric, AnalysisSource, AnalysisInsight, AnalysisRisk,
  AnalysisOpportunity, AnalysisRecommendation, AnalysisResult, AnalysisProgress, AnalysisFail,
  AnalysisJobStatus, AnalysisJobSummary, AnalysisJobsResponse,
  ChatAuthor, ChatMessage, ChatMessagesResponse, SendChatMessageRequest, SendChatMessageResponse,
};
