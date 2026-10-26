import type { AnalysisOutcome, AnalysisStage, AnalysisStatus, EvidenceSourceKind } from "./types";

/** Этапы ML pipeline по порядку (AnalysisStage) */
const STAGE_ORDER: AnalysisStage[] = [
  'loading_profile', 'mapping_exposures', 'planning', 'retrieving', 'analyzing', 'validating', 'completed',
];

const STAGE_LABEL: Record<AnalysisStage, string> = {
  loading_profile: 'Загружаем профиль компании',
  mapping_exposures: 'Определяем факторы влияния на бизнес',
  planning: 'Планируем поиск новостей',
  retrieving: 'Собираем новости и источники',
  analyzing: 'Анализируем найденное',
  validating: 'Проверяем выводы',
  completed: 'Формируем отчёт',
};

const getStageLabel = (stage: AnalysisStage) => STAGE_LABEL[stage] ?? stage;

/** Статусы задания: pending — задача создана, running — анализ выполняется */
const STATUS_LABEL: Record<AnalysisStatus, string> = {
  pending: 'Задача создана',
  running: 'Анализ выполняется',
  completed: 'Анализ завершён',
  failed: 'Анализ не удался',
};

const getStatusLabel = (status: AnalysisStatus) => STATUS_LABEL[status] ?? status;

/** Текст прогресса: «Этап 4 из 7 · Собираем новости и источники» */
const getProgressText = (status: AnalysisStatus | undefined, stage: AnalysisStage | null) => {
  if (!status) return 'Подключаемся к анализу…';
  if (status !== 'running' || !stage) return getStatusLabel(status);

  const step = STAGE_ORDER.indexOf(stage);
  return step === -1 ? getStageLabel(stage) : `Этап ${step + 1} из ${STAGE_ORDER.length} · ${getStageLabel(stage)}`;
}

const OUTCOME_LABEL: Record<AnalysisOutcome, string> = {
  ok: 'Анализ готов',
  partial: 'Частичный результат',
  no_relevant_evidence: 'Значимых событий не найдено',
  failed: 'Анализ не удался',
};

const getOutcomeLabel = (outcome: AnalysisOutcome) => OUTCOME_LABEL[outcome] ?? outcome;

const SOURCE_KIND_LABEL: Record<EvidenceSourceKind, string> = {
  news: 'Новость',
  official_release: 'Официальный релиз',
  bank_research: 'Исследование банка',
  fixture: 'Демо-данные',
};

const getSourceKindLabel = (kind: EvidenceSourceKind) => SOURCE_KIND_LABEL[kind] ?? kind;

export { STAGE_ORDER, getStageLabel, getStatusLabel, getProgressText, getOutcomeLabel, getSourceKindLabel };
