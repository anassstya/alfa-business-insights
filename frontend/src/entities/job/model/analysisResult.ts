import { useEffect } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAnalysis } from "./useAnalysis";
import type { AnalysisFail, AnalysisProgress, AnalysisResult } from "./types";

const analysisKeys = {
  all: ['analysis'] as const,
  result: (jobId: string) => [...analysisKeys.all, 'result', jobId] as const,
}

/**
 * Кладёт результат завершённого анализа в кэш TanStack Query, чтобы страница деталей
 * открылась сразу, без повторной подписки на SSE.
 */
const useSyncAnalysisResult = (jobId: string | undefined, result: AnalysisResult | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (jobId && result) {
      queryClient.setQueryData(analysisKeys.result(jobId), result);
    }
  }, [jobId, result, queryClient])
}

/**
 * Результат анализа по jobId: сначала из кэша (если анализ шёл на этой вкладке),
 * иначе — подписка на SSE задачи: по договорённости сервер сразу после подключения
 * присылает текущий статус, в том числе `completed` с результатом.
 * FIXME(openapi): надёжнее был бы GET /api/v1/analysis/jobs/{jobID} — его нет в спецификации.
 */
const useAnalysisResult = (jobId: string | undefined) => {
  const { data: cached } = useQuery<AnalysisResult>({
    queryKey: analysisKeys.result(jobId ?? ''),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const live = useAnalysis<unknown, AnalysisProgress, AnalysisResult, AnalysisFail>(cached ? undefined : jobId);
  useSyncAnalysisResult(jobId, live.completeData);

  const result = cached ?? live.completeData;
  const isFailed = live.isFail || (live.isError && live.closed);

  return {
    result,
    progress: live.progressData,
    error: live.failData?.error,
    isLoading: !!jobId && !result && !isFailed,
    isError: !jobId || (!result && isFailed),
  }
}

export { analysisKeys, useSyncAnalysisResult, useAnalysisResult };
