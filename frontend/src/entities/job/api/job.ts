/**
 * Имена SSE-событий задачи анализа.
 * FIXME(openapi): эндпоинта GET /api/v1/analysis/jobs/{jobID}/events пока нет в спецификации —
 * имена и формат `data` (JSON) предварительные, их нужно согласовать с backend.
 * Событие `error` серверу использовать нельзя: оно совпадает со встроенной ошибкой соединения EventSource.
 */
const JOB_EVENTS = {
  /** текущий статус задачи — сервер присылает его сразу после подключения */
  connected: 'connected',
  /** промежуточный прогресс от ML */
  progress: 'progress',
  /** задача завершена, в data — результат; поток закрывается */
  completed: 'completed',
  /** задача упала, в data — описание ошибки; поток закрывается */
  failed: 'failed',
  error: 'error'
} as const;

interface Params<TConnect, TProgress, TResult, TFail> {
  onConnect?(data: TConnect, event: MessageEvent<string>): void;
  onProgress?(data: TProgress, event: MessageEvent<string>): void;
  onComplete?(data: TResult, event: MessageEvent<string>): void;
  onFail?(data: TFail, event: MessageEvent<string>): void;
  onError?(event: Event, closed: boolean): void;
}

/** data в SSE — всегда строка; сервер шлёт JSON, но не падаем, если пришёл обычный текст */
const parseData = <T>(event: MessageEvent<string>): T => {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return event.data as unknown as T;
  }
}

/**
 * Подписка на прогресс задачи анализа: GET /api/v1/analysis/jobs/{jobID}/events (SSE).
 * Возвращает функцию отписки — её нужно вызвать при размонтировании (например, из useEffect).
 * После `completed` или `failed` соединение закрывается само, иначе EventSource
 * переподключался бы каждый раз, когда сервер завершает поток.
 */
const analysisJobEvents = <TConnect = unknown, TProgress = unknown, TResult = unknown, TFail = unknown>(
  job: string,
  { onConnect, onProgress, onComplete, onFail, onError }: Params<TConnect, TProgress, TResult, TFail>,
) => {
  if (!job) {
    return () => {};
  }

  const url = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/analysis/jobs/${encodeURIComponent(job)}/events`

  const source = new EventSource(url)

  source.addEventListener(JOB_EVENTS.connected, (event) => {
    onConnect?.(parseData<TConnect>(event), event);
  });

  source.addEventListener(JOB_EVENTS.progress, (event) => {
    onProgress?.(parseData<TProgress>(event), event);
  });

  source.addEventListener(JOB_EVENTS.completed, (event) => {
    source.close();
    onComplete?.(parseData<TResult>(event), event);
  });

  source.addEventListener(JOB_EVENTS.failed, (event) => {
    source.close();
    onFail?.(parseData<TFail>(event), event);
  });

  source.addEventListener(JOB_EVENTS.error, (event) => {
    onError?.(event, source.readyState === EventSource.CLOSED);
  });

  return () => source.close();
}

export { analysisJobEvents, JOB_EVENTS }
