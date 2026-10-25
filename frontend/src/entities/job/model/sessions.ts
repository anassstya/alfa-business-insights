import { useCallback, useSyncExternalStore } from "react";

/** Запущенный пользователем анализ — «сессия» в меню «Мои анализы» */
interface AnalysisSession {
  jobId: string;
  companyId: number;
  /** подпись компании на момент запуска — чтобы меню не грузило каждую компанию отдельно */
  companyLabel: string;
  role: string;
  roleLabel: string;
  goal?: string;
  /** ISO 8601 */
  createdAt: string;
}

/**
 * FIXME(openapi): списка задач пользователя в API нет, поэтому сессии хранятся только
 * в localStorage этого браузера — по отдельному списку на каждого демопользователя.
 */
const STORAGE_PREFIX = 'abi:analysis-sessions:';
const MAX_SESSIONS = 30;

const storageKey = (userId?: number) => `${STORAGE_PREFIX}${userId ?? 'guest'}`;

const EMPTY: AnalysisSession[] = [];
/** кэш прочитанных списков: useSyncExternalStore требует стабильный снимок между вызовами */
const snapshots = new Map<string, AnalysisSession[]>();
const listeners = new Set<() => void>();

const read = (key: string): AnalysisSession[] => {
  const cached = snapshots.get(key);
  if (cached) return cached;

  let sessions = EMPTY;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(parsed)) sessions = parsed;
  } catch {
    // повреждённые данные или недоступный localStorage — начинаем с пустого списка
  }

  snapshots.set(key, sessions);
  return sessions;
}

const write = (key: string, sessions: AnalysisSession[]) => {
  snapshots.set(key, sessions);
  try {
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {
    // в приватном режиме список проживёт только до перезагрузки
  }
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  // изменения из других вкладок
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(STORAGE_PREFIX)) {
      snapshots.delete(event.key);
      listener();
    }
  }
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  }
}

/** Сессии анализа демопользователя: новые сверху, не больше MAX_SESSIONS */
const useAnalysisSessions = (userId?: number) => {
  const key = storageKey(userId);
  const sessions = useSyncExternalStore(subscribe, () => read(key));

  const addSession = useCallback((session: AnalysisSession) => {
    const rest = read(key).filter(item => item.jobId !== session.jobId);
    write(key, [session, ...rest].slice(0, MAX_SESSIONS));
  }, [key])

  const removeSession = useCallback((jobId: string) => {
    write(key, read(key).filter(item => item.jobId !== jobId));
  }, [key])

  return { sessions, addSession, removeSession };
}

export { useAnalysisSessions, type AnalysisSession };
