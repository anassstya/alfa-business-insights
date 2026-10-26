/* Типы по backend/api/openapi.yaml (components/schemas) */

/** AnalysisStatus — состояние задания в Go и PostgreSQL */
type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

/** AnalysisStage — текущий этап ML pipeline */
type AnalysisStage =
  | 'loading_profile'
  | 'mapping_exposures'
  | 'planning'
  | 'retrieving'
  | 'analyzing'
  | 'validating'
  | 'completed';

/** AnalysisOutcome — содержательный исход анализа (не то же, что статус задания) */
type AnalysisOutcome = 'ok' | 'partial' | 'no_relevant_evidence' | 'failed';

/** BankView — позиция банка по событию; до подключения банковских PDF ожидается unavailable */
interface BankView {
  status?: 'available' | 'unavailable';
  text?: string | null;
  /** ISO 8601 */
  report_at?: string | null;
  evidence_refs?: string[];
}

/** Insight — один вывод анализа */
interface Insight {
  insight_id: string;
  /** что произошло */
  event: string;
  ai_interpretation?: string;
  /** почему это важно компании */
  company_relevance: string;
  /** почему это важно для выбранной роли */
  role_relevance: string;
  /** цепочка влияния события на компанию, по шагам */
  impact_chain: string[];
  bank_view?: BankView;
  risks?: string[];
  opportunities?: string[];
  suggested_actions?: string[];
  assumptions?: string[];
  uncertainty: string;
  /** evidence_id из AnalysisResult.evidence */
  evidence_refs: string[];
  evidence_sources?: Record<string, unknown>[];
  feature_refs: string[];
  /** порядок важности, начиная с 1 */
  rank: number;
}

type EvidenceSourceKind = 'news' | 'official_release' | 'bank_research' | 'fixture';

/** EvidenceRecord — источник (новость, релиз, исследование), на который опираются выводы */
interface EvidenceRecord {
  evidence_id: string;
  document_id: string;
  source_kind: EvidenceSourceKind;
  title: string;
  publisher?: string | null;
  url?: string | null;
  /** ISO 8601 */
  published_at?: string | null;
  /** ISO 8601 */
  retrieved_at: string;
  excerpt: string;
  date_status: 'known' | 'unknown' | 'archived';
  content_status: 'full_text' | 'excerpt_only' | 'fetch_failed' | 'paywall';
}

/** StageEvent — запись трассировки этапов ML */
interface StageEvent {
  job_id: string;
  run_id: string;
  seq: number;
  stage: AnalysisStage;
  state: 'started' | 'completed' | 'failed' | 'skipped';
  /** ISO 8601 */
  at: string;
  summary: string;
  counters?: Record<string, number>;
}

/**
 * AnalysisResult — полный JSON результата ML v1 (AnalysisJob.result).
 * Внимание: company_id здесь — синтетический код `U_…`, числовой id компании — company_row_id.
 * mode=fixture — демонстрационный сценарий, не реальные новости.
 */
interface AnalysisResult {
  schema_version?: '1.0';
  job_id: string;
  run_id: string;
  company_id: string;
  company_row_id: number;
  role: string;
  goal?: string | null;
  /** на какую дату собран анализ, ISO 8601 */
  as_of: string;
  mode?: 'fixture' | 'live';
  outcome: AnalysisOutcome;
  /** не больше 5 */
  insights?: Insight[];
  evidence?: EvidenceRecord[];
  profile_snapshot?: Record<string, unknown> | null;
  research_context?: Record<string, unknown> | null;
  warnings?: string[];
  trace?: StageEvent[];
  usage?: Record<string, unknown>;
  versions?: Record<string, string>;
}

/** AnalysisJobSummary — элемент `jobs[]` в GET /api/v1/demo/users/{id}/analysis/jobs */
interface AnalysisJobSummary {
  job_id: string;
  /** числовой companies.id, не synthetic_u */
  company_id: number;
  role: string;
  goal: string | null;
  status: AnalysisStatus;
  stage: AnalysisStage | null;
  /** ISO 8601 */
  created_at: string;
}

/**
 * AnalysisJob — состояние задания и полный результат: ответ GET /api/v1/analysis/jobs/{jobID}
 * и data события `update` в SSE /events. result равен null до финального callback ML.
 */
interface AnalysisJob extends AnalysisJobSummary {
  demo_user_id: number | null;
  result: AnalysisResult | null;
  error_message: string | null;
  /** ISO 8601 */
  updated_at: string;
}

/** Ответ GET /api/v1/demo/users/{id}/analysis/jobs — задачи от новых к старым */
interface AnalysisJobsResponse {
  jobs: AnalysisJobSummary[];
}

type ChatAuthor = 'user' | 'assistant';

/** ChatMessage — сообщение чата аналитической сессии */
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
  AnalysisStatus, AnalysisStage, AnalysisOutcome, BankView, Insight, EvidenceSourceKind, EvidenceRecord, StageEvent,
  AnalysisResult, AnalysisJobSummary, AnalysisJob, AnalysisJobsResponse,
  ChatAuthor, ChatMessage, ChatMessagesResponse, SendChatMessageRequest, SendChatMessageResponse,
};
