import { apiClient } from "@/shared";
import type { AnalysisJob, AnalysisStatus } from "../model/types";

/**
 * GET /api/v1/analysis/jobs/{jobID} — задача целиком: статус, этап, ошибка и AnalysisResult в result
 * (во время pending/running result обычно null). 400 — некорректный job_id, 404 — задача не найдена.
 */
const getAnalysisJob = async (jobId: string, signal?: AbortSignal) => {
  const { data } = await apiClient.get<AnalysisJob>(`/api/v1/analysis/jobs/${encodeURIComponent(jobId)}`, { signal });

  return data;
}

/**
 * События SSE GET /api/v1/analysis/jobs/{jobID}/events (см. openapi.yaml):
 * `update` с JSON AnalysisJob — сразу после подключения и при каждом изменении записи
 * (backend проверяет PostgreSQL примерно раз в 2 секунды); между ними — комментарии `: ping`.
 */
const JOB_EVENTS = {
  update: 'update',
} as const;

/** Финальные статусы: после них задача больше не меняется */
const isFinalStatus = (status: AnalysisStatus | undefined) => status === 'completed' || status === 'failed';

interface Params {
  /** новое состояние задачи, в том числе первое — сразу после подключения */
  onUpdate(job: AnalysisJob, event: MessageEvent<string>): void;
  /**
   * Ошибка соединения. При `closed: false` браузер сам переподключится,
   * при `closed: true` — сдался (например, 404 или 500 на подключении).
   */
  onError?(event: Event, closed: boolean): void;
}

/**
 * Подписка на состояние задачи анализа по SSE. Возвращает функцию отписки —
 * её нужно вызвать при размонтировании или смене задачи (например, из useEffect).
 * Backend не закрывает поток после completed/failed, поэтому закрываем его сами:
 * иначе соединение и ping-и висели бы до ухода со страницы.
 */
const analysisJobEvents = (jobId: string, { onUpdate, onError }: Params) => {
  const url = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/analysis/jobs/${encodeURIComponent(jobId)}/events`;
  const source = new EventSource(url);

  source.addEventListener(JOB_EVENTS.update, (event) => {
    let job: AnalysisJob;
    try {
      job = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!job || typeof job.status !== 'string') return;

    if (isFinalStatus(job.status)) source.close();
    onUpdate(job, event);
  });

  source.addEventListener('error', (event) => {
    onError?.(event, source.readyState === EventSource.CLOSED);
  });

  return () => source.close();
}

export { getAnalysisJob, analysisJobEvents, isFinalStatus, JOB_EVENTS };
