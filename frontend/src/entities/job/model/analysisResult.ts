import { useEffect } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { isFinalStatus } from "../api/job";
import { useAnalysis } from "./useAnalysis";
import type { AnalysisJob } from "./types";

const analysisKeys = {
  all: ['analysis'] as const,
  /** завершённая задача (completed/failed) — больше не меняется, SSE для неё не нужен */
  job: (jobId: string) => [...analysisKeys.all, 'job', jobId] as const,
  history: (userId: number) => [...analysisKeys.all, 'history', userId] as const,
  chat: (jobId: string) => [...analysisKeys.all, 'chat', jobId] as const,
}

/**
 * Состояние задачи анализа и её результат по jobId.
 * Завершённую задачу берём из кэша; иначе подписываемся на SSE /events — backend сразу
 * присылает текущее AnalysisJob, затем обновления. Финальное состояние кладём в кэш,
 * чтобы при возврате к сессии и на странице деталей не подключаться заново.
 */
const useAnalysisResult = (jobId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: cached } = useQuery<AnalysisJob>({
    queryKey: analysisKeys.job(jobId ?? ''),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const live = useAnalysis(cached ? undefined : jobId);

  useEffect(() => {
    if (jobId && live.job && isFinalStatus(live.job.status)) {
      queryClient.setQueryData(analysisKeys.job(jobId), live.job);
    }
  }, [jobId, live.job, queryClient])

  const job = cached ?? live.job;
  const status = job?.status;
  const result = status === 'completed' ? job?.result ?? undefined : undefined;
  // соединение оборвалось насовсем, а финального состояния так и не пришло
  const isConnectionLost = live.isConnectionError && live.isConnectionClosed && !isFinalStatus(status);

  return {
    job,
    result,
    status,
    stage: job?.stage ?? null,
    error: job?.error_message
      ?? (isConnectionLost ? 'Не удалось получить состояние анализа' : undefined)
      ?? (status === 'completed' && !result ? 'Анализ завершён, но результат не сохранён' : undefined),
    isLoading: !!jobId && !isConnectionLost && !isFinalStatus(status),
    isError: !!jobId && (isConnectionLost || status === 'failed' || (status === 'completed' && !result)),
  }
}

export { analysisKeys, useAnalysisResult };
