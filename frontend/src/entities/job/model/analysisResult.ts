import { isAxiosError } from "axios";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getAnalysisJob, isFinalStatus } from "../api/job";
import { analysisKeys } from "./keys";
import { useAnalysis } from "./useAnalysis";

/**
 * Задача анализа по GET /api/v1/analysis/jobs/{jobID}. Пока задача не завершена,
 * эти же данные обновляет SSE (useAnalysis), поэтому сами по себе они не устаревают.
 */
const analysisJobQuery = (jobId: string | undefined) => queryOptions({
  queryKey: analysisKeys.job(jobId ?? ''),
  queryFn: ({ signal }) => getAnalysisJob(jobId!, signal),
  enabled: !!jobId,
  staleTime: Infinity,
});

const getRequestError = (error: unknown) => {
  const status = isAxiosError(error) ? error.response?.status : undefined;

  if (status === 404) return 'Анализ не найден';
  if (status === 400) return 'Некорректный идентификатор анализа';
  return 'Не удалось получить анализ';
}

/**
 * Состояние задачи анализа и её результат по jobId.
 * Сначала запрашиваем задачу (GET jobs/{jobID}): если она уже completed/failed — это и есть
 * итог, к SSE не подключаемся. Если pending/running — подписываемся на /events, backend сразу
 * присылает текущее AnalysisJob, затем обновления; после финального статуса поток закрывается.
 */
const useAnalysisResult = (jobId: string | undefined) => {
  const query = useQuery(analysisJobQuery(jobId));
  const job = query.data;
  const status = job?.status;

  // SSE нужен только незавершённой задаче, и только когда её текущее состояние уже получено
  const live = useAnalysis(query.isSuccess && !isFinalStatus(status) ? jobId : undefined);

  const result = status === 'completed' ? job?.result ?? undefined : undefined;
  // соединение оборвалось насовсем, а финального состояния так и не пришло
  const isConnectionLost = live.isConnectionError && live.isConnectionClosed && !isFinalStatus(status);

  return {
    job,
    result,
    status,
    stage: job?.stage ?? null,
    error: (query.isError ? getRequestError(query.error) : undefined)
      ?? job?.error_message
      ?? (isConnectionLost ? 'Не удалось получить состояние анализа' : undefined)
      ?? (status === 'completed' && !result ? 'Анализ завершён, но результат не сохранён' : undefined),
    isLoading: !!jobId && !query.isError && !isConnectionLost && !isFinalStatus(status),
    isError: !!jobId && (
      query.isError || isConnectionLost || status === 'failed' || (status === 'completed' && !result)
    ),
  }
}

export { analysisJobQuery, useAnalysisResult };
