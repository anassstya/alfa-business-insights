import { useQuery } from "@tanstack/react-query";
import { getDemoUserAnalysisJobs } from "../api/history";
import { analysisKeys } from "./analysisResult";

/** История анализов демопользователя с сервера; без выбранного пользователя запрос не идёт */
const useDemoUserAnalysisJobs = (userId?: number) => useQuery({
  queryKey: analysisKeys.history(userId ?? 0),
  queryFn: ({ signal }) => getDemoUserAnalysisJobs(userId!, signal),
  enabled: !!userId,
  staleTime: 1000 * 30,
})

const JOB_STATUS_LABEL: Record<string, string> = {
  pending: 'В очереди',
  queued: 'В очереди',
  running: 'Выполняется',
  processing: 'Выполняется',
  in_progress: 'Выполняется',
  completed: 'Готов',
  done: 'Готов',
  success: 'Готов',
  failed: 'Ошибка',
  error: 'Ошибка',
};

/** Подпись статуса задачи; неизвестный статус (их задаёт ML) показываем как есть */
const getJobStatusLabel = (status: string) => JOB_STATUS_LABEL[status] ?? status;

type JobStatusTone = 'progress' | 'success' | 'error' | 'neutral';

const getJobStatusTone = (status: string): JobStatusTone => {
  const label = JOB_STATUS_LABEL[status];
  if (label === 'Готов') return 'success';
  if (label === 'Ошибка') return 'error';
  if (label) return 'progress';

  return 'neutral';
}

export { useDemoUserAnalysisJobs, getJobStatusLabel, getJobStatusTone, type JobStatusTone };
